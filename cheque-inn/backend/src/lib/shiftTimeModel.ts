/**
 * Shift wall-clock model (HH:mm, no calendar date on the shift row).
 *
 * @see backend/docs/SHIFT_AND_OVERNIGHT_ARCHITECTURE.md
 *
 * Product status:
 * - API only allows same-calendar-day spans (end_time > start_time).
 * - Lateness and shift overtime use same-day minute comparison (not overnight-aware).
 * - Early leave / half-day uses duration-from-check-in (overnight-span aware).
 */

/** Parse `HH:mm` or `HH:mm:ss` to minutes since midnight [0, 1439], or null if invalid. */
export function parseTimeToMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }
  return h * 60 + m;
}

/** True when shift end is at or before start on the clock (overnight span definition). */
export function isOvernightShiftSpan(startMinutes: number, endMinutes: number): boolean {
  return endMinutes <= startMinutes;
}

/** True when the product allows this span via shifts API (end strictly after start, same day). */
export function isSameDayShiftSpan(startMinutes: number, endMinutes: number): boolean {
  return endMinutes > startMinutes;
}

/**
 * Lateness for same-day shifts: minutes after shift start + grace on the check-in calendar day.
 * NOT valid when {@link isOvernightShiftSpan} — late check-ins after midnight appear "on time".
 */
export function computeLateMinutesSameDay(
  checkInMinutes: number,
  shiftStartMinutes: number,
  graceMinutes: number
): number {
  const allowed = shiftStartMinutes + Math.max(0, graceMinutes);
  if (checkInMinutes <= allowed) return 0;
  return checkInMinutes - allowed;
}

/**
 * Shift overtime for same-day shifts: minutes clock-out is after shift end on that wall-clock day.
 * NOT valid when {@link isOvernightShiftSpan} — can report false overtime before midnight.
 */
export function computeOvertimeMinutesSameDay(
  clockOutMinutes: number,
  shiftEndMinutes: number
): number {
  if (clockOutMinutes <= shiftEndMinutes) return 0;
  return clockOutMinutes - shiftEndMinutes;
}

/** Expected shift length in minutes (supports overnight span math for early-leave module). */
export function expectedShiftDurationMinutes(startMinutes: number, endMinutes: number): number {
  if (startMinutes === endMinutes) return 0;
  return endMinutes > startMinutes
    ? endMinutes - startMinutes
    : 24 * 60 - startMinutes + endMinutes;
}
