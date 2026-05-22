import type { ShiftWindowSource } from "./types";
import { resolveShiftWindowAtCheckIn } from "./resolveShiftWindow";
import {
  computeLateMinutesFromWindow,
  computeOvertimeMinutesFromWindow,
} from "./shiftMetrics";

export function toShiftWindowSource(shift: {
  id: string;
  start_time: string;
  end_time: string;
  grace_minutes: number | null;
  spans_midnight?: boolean | null;
  is_active?: boolean | null;
}): ShiftWindowSource {
  return {
    id: shift.id,
    start_time: shift.start_time,
    end_time: shift.end_time,
    grace_minutes: shift.grace_minutes,
    spans_midnight: shift.spans_midnight === true,
    is_active: shift.is_active !== false,
  };
}

/** Resolve window at clock-in anchor. */
export function resolveWindowAtCheckIn(params: {
  checkInIso: string;
  businessTimeZone: string;
  overnightShiftsEnabled: boolean;
  shift: ShiftWindowSource | null;
}) {
  return resolveShiftWindowAtCheckIn({
    checkInIso: params.checkInIso,
    businessTimeZone: params.businessTimeZone,
    overnightShiftsEnabled: params.overnightShiftsEnabled,
    shift: params.shift,
  });
}

export function lateMinutesAtCheckIn(params: {
  checkInIso: string;
  businessTimeZone: string;
  overnightShiftsEnabled: boolean;
  shift: ShiftWindowSource | null;
}): number {
  const window = resolveWindowAtCheckIn(params);
  return computeLateMinutesFromWindow(window, params.checkInIso, params.businessTimeZone);
}

export function overtimeMinutesAtCheckOut(params: {
  checkInIso: string;
  checkOutIso: string;
  businessTimeZone: string;
  overnightShiftsEnabled: boolean;
  shift: ShiftWindowSource | null;
}): number {
  const window = resolveWindowAtCheckIn({
    checkInIso: params.checkInIso,
    businessTimeZone: params.businessTimeZone,
    overnightShiftsEnabled: params.overnightShiftsEnabled,
    shift: params.shift,
  });
  return computeOvertimeMinutesFromWindow(
    window,
    params.checkOutIso,
    params.businessTimeZone
  );
}
