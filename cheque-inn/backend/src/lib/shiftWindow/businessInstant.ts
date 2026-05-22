import {
  calendarYmdInTimeZone,
  normalizeBusinessTimeZone,
  utcHalfOpenRangeForCalendarDateInZone,
} from "../businessCalendar";
import { getClockMinutesInBusinessZone } from "../attendanceClockTime";

/** ISO calendar date YYYY-MM-DD plus/minus whole days (UTC date math on components). */
export function addDaysToYmd(ymdIso: string, deltaDays: number): string {
  const [y, m, d] = ymdIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Wall-clock YMD + minutes since midnight for an instant in the business zone. */
export function calendarYmdAndMinutesInBusinessZone(
  iso: string,
  timeZone: string
): { ymd: string; minutes: number } {
  const tz = normalizeBusinessTimeZone(timeZone);
  const d = new Date(iso);
  const ymd = calendarYmdInTimeZone(d, tz).iso;
  const minutes = getClockMinutesInBusinessZone(iso, tz);
  return { ymd, minutes };
}

/**
 * UTC ISO instant at `minutesSinceMidnight` on calendar `ymdIso` in `timeZone`.
 * Uses business-day start from {@link utcHalfOpenRangeForCalendarDateInZone}.
 */
export function utcInstantAtWallMinutesOnCalendarDate(
  ymdIso: string,
  minutesSinceMidnight: number,
  timeZone: string
): string {
  const tz = normalizeBusinessTimeZone(timeZone);
  const { startIso } = utcHalfOpenRangeForCalendarDateInZone(ymdIso, tz);
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutesSinceMidnight));
  return new Date(new Date(startIso).getTime() + clamped * 60_000).toISOString();
}
