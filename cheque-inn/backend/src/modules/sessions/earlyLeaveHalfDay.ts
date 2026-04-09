/**
 * Pure calculation for early_leave_minutes and half_day.
 * Timeline-based: expected check-out = check-in + expectedShiftMinutes.
 * Supports same-day (e.g. 09:00–17:00) and overnight (e.g. 22:00–06:00).
 */
export function computeEarlyLeaveAndHalfDay(
  startMinutes: number,
  endMinutes: number,
  checkInIso: string,
  checkOutIso: string,
  durationMinutes: number
): { earlyLeaveMinutes: number; halfDay: boolean } {
  if (durationMinutes < 0) {
    return { earlyLeaveMinutes: 0, halfDay: false };
  }
  if (startMinutes === endMinutes) {
    return { earlyLeaveMinutes: 0, halfDay: false };
  }

  const expectedShiftMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : 24 * 60 - startMinutes + endMinutes;

  if (expectedShiftMinutes <= 0) {
    return { earlyLeaveMinutes: 0, halfDay: false };
  }

  const checkInMs = new Date(checkInIso).getTime();
  const checkOutMs = new Date(checkOutIso).getTime();
  const expectedCheckOutMs = checkInMs + expectedShiftMinutes * 60 * 1000;
  const earlyLeaveMinutes = Math.max(
    0,
    Math.floor((expectedCheckOutMs - checkOutMs) / 60000)
  );
  // half_day = true only when worked time is strictly less than 50% of expected shift
  const halfDay = durationMinutes < 0.5 * expectedShiftMinutes;

  return { earlyLeaveMinutes, halfDay };
}
