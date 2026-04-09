/**
 * Wall-clock time-of-day in UTC for an instant, for comparison to shift HH:mm strings.
 * See docs/TIMEZONE_ATTENDANCE.md — timestamps are stored in UTC; "today" windows use UTC.
 */
export function getClockMinutesUtcFromIso(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Minutes since 00:00 UTC today (for "is it past shift start yet" vs shift strings). */
export function getNowClockMinutesUtc(): number {
  const n = new Date();
  return n.getUTCHours() * 60 + n.getUTCMinutes();
}
