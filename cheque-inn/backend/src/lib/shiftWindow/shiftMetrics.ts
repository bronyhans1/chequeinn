import {
  computeLateMinutesSameDay,
  computeOvertimeMinutesSameDay,
} from "../shiftTimeModel";
import { getClockMinutesInBusinessZone } from "../attendanceClockTime";
import { calendarYmdAndMinutesInBusinessZone } from "./businessInstant";
import type { ResolvedShiftWindow } from "./types";

function minutesBetween(startMs: number, endMs: number): number {
  const diff = endMs - startMs;
  if (diff <= 0) return 0;
  return Math.floor(diff / 60_000);
}

/**
 * Lateness vs shift start (+ grace). Routes through resolved window — no scattered HH:mm math.
 */
export function computeLateMinutesFromWindow(
  window: ResolvedShiftWindow,
  checkInIso: string,
  businessTimeZone: string
): number {
  if (window.expectedDurationMinutes <= 0) return 0;

  if (window.overnightLogicActive && window.lateAllowedUntilUtcIso) {
    const checkInMs = new Date(checkInIso).getTime();
    const allowedMs = new Date(window.lateAllowedUntilUtcIso).getTime();
    if (checkInMs <= allowedMs) return 0;
    return minutesBetween(allowedMs, checkInMs);
  }

  const checkInMinutes = getClockMinutesInBusinessZone(checkInIso, businessTimeZone);
  return computeLateMinutesSameDay(
    checkInMinutes,
    window.startMinutes,
    window.graceMinutes
  );
}

/**
 * Shift-end overtime. Routes through resolved window.
 */
export function computeOvertimeMinutesFromWindow(
  window: ResolvedShiftWindow,
  checkOutIso: string,
  businessTimeZone: string
): number {
  if (window.expectedDurationMinutes <= 0) return 0;

  if (window.overnightLogicActive && window.expectedEndUtcIso) {
    const checkOutMs = new Date(checkOutIso).getTime();
    const expectedEndMs = new Date(window.expectedEndUtcIso).getTime();
    if (checkOutMs <= expectedEndMs) return 0;
    return minutesBetween(expectedEndMs, checkOutMs);
  }

  const clockOutMinutes = getClockMinutesInBusinessZone(checkOutIso, businessTimeZone);
  return computeOvertimeMinutesSameDay(clockOutMinutes, window.endMinutes);
}

/**
 * True when `now` falls inside the active attendance obligation window for an overnight shift.
 * Between shift end and next shift start → false (not expected on-site).
 */
export function isNowWithinOvernightAttendanceWindow(
  window: ResolvedShiftWindow,
  nowIso: string,
  businessTimeZone: string
): boolean {
  if (!window.overnightLogicActive) return false;
  const { ymd, minutes } = calendarYmdAndMinutesInBusinessZone(nowIso, businessTimeZone);
  const { startMinutes: startM, endMinutes: endM } = window;
  if (minutes >= startM) return true;
  if (minutes <= endM) return true;
  return false;
}

/**
 * Whether a user without a session today should count as absent for their shift right now.
 * Daytime: wall-clock minutes past start + grace on today's calendar day.
 * Overnight: only when inside the active shift window and past cycle start + grace.
 */
export function shouldMarkAbsentNow(
  window: ResolvedShiftWindow,
  nowIso: string,
  businessTimeZone: string
): boolean {
  if (window.expectedDurationMinutes <= 0) return false;

  if (window.overnightLogicActive) {
    if (!isNowWithinOvernightAttendanceWindow(window, nowIso, businessTimeZone)) {
      return false;
    }
    if (!window.lateAllowedUntilUtcIso) return false;
    const nowMs = new Date(nowIso).getTime();
    return nowMs > new Date(window.lateAllowedUntilUtcIso).getTime();
  }

  const currentMinutes = getClockMinutesInBusinessZone(nowIso, businessTimeZone);
  return currentMinutes > window.startMinutes + window.graceMinutes;
}
