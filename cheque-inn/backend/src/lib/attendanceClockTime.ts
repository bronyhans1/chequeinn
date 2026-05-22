import { normalizeBusinessTimeZone } from "./businessCalendar";

/**
 * Wall-clock time-of-day in UTC for an instant, for comparison to shift HH:mm strings.
 * Prefer {@link getClockMinutesInBusinessZone} when company policy timezone is known.
 */
export function getClockMinutesUtcFromIso(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Minutes since 00:00 UTC on the current UTC calendar day. */
export function getNowClockMinutesUtc(): number {
  const n = new Date();
  return n.getUTCHours() * 60 + n.getUTCMinutes();
}

/** Wall-clock minutes since midnight in the company IANA zone (for shift HH:mm comparison). */
export function getClockMinutesInBusinessZone(
  iso: string,
  timeZone: string | null | undefined
): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const tz = normalizeBusinessTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(d);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return getClockMinutesUtcFromIso(iso);
    return h * 60 + m;
  } catch {
    return getClockMinutesUtcFromIso(iso);
  }
}

/** Current wall-clock minutes in the company zone (for absentee vs shift start). */
export function getNowClockMinutesInBusinessZone(timeZone: string | null | undefined): number {
  return getClockMinutesInBusinessZone(new Date().toISOString(), timeZone);
}
