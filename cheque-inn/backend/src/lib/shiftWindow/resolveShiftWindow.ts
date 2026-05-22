import { parseTimeToMinutes, expectedShiftDurationMinutes } from "../shiftTimeModel";
import {
  addDaysToYmd,
  calendarYmdAndMinutesInBusinessZone,
  utcInstantAtWallMinutesOnCalendarDate,
} from "./businessInstant";
import type { ResolvedShiftWindow, ResolveShiftWindowInput } from "./types";

/** Legacy payroll bucket key: UTC calendar date of check-in (matches `salaryAttendanceDayFromCheckIn`). */
export function attendanceDateYmdFromCheckInUtcSlice(checkInIso: string): string {
  return checkInIso.slice(0, 10);
}

function neutralWindow(attendanceDateYmd: string): ResolvedShiftWindow {
  return {
    startMinutes: 0,
    endMinutes: 0,
    spansMidnight: false,
    overnightLogicActive: false,
    expectedDurationMinutes: 0,
    graceMinutes: 0,
    attendanceDateYmd,
    shiftStartUtcIso: null,
    expectedEndUtcIso: null,
    lateAllowedUntilUtcIso: null,
  };
}

/**
 * Shift-start business date for an overnight span anchored at `anchorIso`.
 * Rule: entire session belongs to shift-start business date.
 */
export function shiftStartBusinessDateYmd(params: {
  anchorIso: string;
  businessTimeZone: string;
  startMinutes: number;
  endMinutes: number;
}): string {
  const { ymd, minutes } = calendarYmdAndMinutesInBusinessZone(
    params.anchorIso,
    params.businessTimeZone
  );
  if (minutes >= params.startMinutes) {
    return ymd;
  }
  if (minutes <= params.endMinutes) {
    return addDaysToYmd(ymd, -1);
  }
  return ymd;
}

/**
 * Central entry: shift window metadata + attendance ownership + UTC anchors for overnight math.
 */
export function resolveShiftWindow(input: ResolveShiftWindowInput): ResolvedShiftWindow {
  const anchorIso = input.anchorIso;
  const legacyAttendance = attendanceDateYmdFromCheckInUtcSlice(anchorIso);
  const shift = input.shift;

  if (!shift || !shift.is_active) {
    return neutralWindow(legacyAttendance);
  }

  const startM = parseTimeToMinutes(shift.start_time);
  const endM = parseTimeToMinutes(shift.end_time);
  if (startM === null || endM === null) {
    return neutralWindow(legacyAttendance);
  }

  const clockSpansMidnight = endM <= startM;
  const spansMidnight = Boolean(
    input.overnightShiftsEnabled && shift.spans_midnight && clockSpansMidnight
  );
  const graceMinutes = Math.max(0, shift.grace_minutes ?? 0);
  const expectedDurationMinutes = expectedShiftDurationMinutes(startM, endM);

  if (!spansMidnight) {
    return {
      startMinutes: startM,
      endMinutes: endM,
      spansMidnight: false,
      overnightLogicActive: false,
      expectedDurationMinutes,
      graceMinutes,
      attendanceDateYmd: legacyAttendance,
      shiftStartUtcIso: null,
      expectedEndUtcIso: null,
      lateAllowedUntilUtcIso: null,
    };
  }

  const tz = input.businessTimeZone;
  const shiftStartYmd = shiftStartBusinessDateYmd({
    anchorIso,
    businessTimeZone: tz,
    startMinutes: startM,
    endMinutes: endM,
  });

  const shiftStartUtcIso = utcInstantAtWallMinutesOnCalendarDate(
    shiftStartYmd,
    startM,
    tz
  );
  const expectedEndUtcIso = new Date(
    new Date(shiftStartUtcIso).getTime() + expectedDurationMinutes * 60_000
  ).toISOString();
  const lateAllowedUntilUtcIso = new Date(
    new Date(shiftStartUtcIso).getTime() + graceMinutes * 60_000
  ).toISOString();

  return {
    startMinutes: startM,
    endMinutes: endM,
    spansMidnight: true,
    overnightLogicActive: true,
    expectedDurationMinutes,
    graceMinutes,
    attendanceDateYmd: shiftStartYmd,
    shiftStartUtcIso,
    expectedEndUtcIso,
    lateAllowedUntilUtcIso,
  };
}

/** Convenience wrapper — anchor is check-in instant. */
export function resolveShiftWindowAtCheckIn(
  input: Omit<ResolveShiftWindowInput, "anchorIso"> & { checkInIso: string }
): ResolvedShiftWindow {
  return resolveShiftWindow({ ...input, anchorIso: input.checkInIso });
}
