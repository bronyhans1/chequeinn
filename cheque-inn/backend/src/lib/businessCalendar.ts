/** Calendar utilities using an IANA timezone (company "business day"). */

export type CalendarYmd = { year: number; month: number; day: number; iso: string };

/**
 * Validate IANA timezone; fall back to UTC when invalid or empty.
 */
export function normalizeBusinessTimeZone(raw: string | null | undefined): string {
  const v = (raw ?? "UTC").trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return "UTC";
  }
}

/**
 * Calendar YYYY-MM-DD in the given IANA zone for `now`.
 */
export function calendarYmdInTimeZone(now: Date, timeZone: string): CalendarYmd {
  const tz = normalizeBusinessTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const fallback = now.toISOString().slice(0, 10);
    const [fy, fm, fd] = fallback.split("-").map(Number);
    return {
      year: fy,
      month: fm,
      day: fd,
      iso: fallback,
    };
  }
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { year: y, month: m, day: d, iso };
}

/** `{ year, month, todayIso }` for earnings month windows using company timezone. */
export function yearMonthTodayInTimeZone(now: Date, timeZone: string): {
  year: number;
  month: number;
  todayIso: string;
} {
  const cal = calendarYmdInTimeZone(now, timeZone);
  return { year: cal.year, month: cal.month, todayIso: cal.iso };
}

/**
 * UTC half-open range `[startIso, endIso)` covering the calendar day `ymdIso` (YYYY-MM-DD) in `timeZone`.
 * Used for "today's sessions" and other business-day queries aligned with company policy.
 */
export function utcHalfOpenRangeForCalendarDateInZone(
  ymdIso: string,
  timeZone: string
): { startIso: string; endIso: string } {
  const tz = normalizeBusinessTimeZone(timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymdIso)) {
    const n = new Date();
    const fallback = calendarYmdInTimeZone(n, tz).iso;
    return utcHalfOpenRangeForCalendarDateInZone(fallback, tz);
  }

  const [y, m, d] = ymdIso.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const keyAt = (t: number): string => {
    const parts = fmt.formatToParts(new Date(t));
    const yy = parts.find((p) => p.type === "year")?.value;
    const mm = parts.find((p) => p.type === "month")?.value;
    const dd = parts.find((p) => p.type === "day")?.value;
    return yy && mm && dd ? `${yy}-${mm}-${dd}` : "";
  };

  const anchor = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  let lo = anchor - 48 * 3600 * 1000;
  let hi = anchor + 48 * 3600 * 1000;
  let first = -1;
  const step = 15 * 60 * 1000;
  for (let t = lo; t <= hi; t += step) {
    if (keyAt(t) === ymdIso) {
      first = t;
      break;
    }
  }

  if (first < 0) {
    const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    const end = start + 24 * 3600 * 1000;
    return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
  }

  while (first > lo && keyAt(first - 1) === ymdIso) first -= 1;
  while (keyAt(first) !== ymdIso) first += 1;

  if (keyAt(first) !== ymdIso) {
    const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    const end = start + 24 * 3600 * 1000;
    return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
  }

  const nextUtc = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = `${nextUtc.getUTCFullYear()}-${String(nextUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(nextUtc.getUTCDate()).padStart(2, "0")}`;
  const [yn, mn, dn] = nextYmd.split("-").map(Number);
  const anchorN = Date.UTC(yn, mn - 1, dn, 12, 0, 0, 0);
  let loN = anchorN - 48 * 3600 * 1000;
  let hiN = anchorN + 48 * 3600 * 1000;
  let second = -1;
  for (let t = loN; t <= hiN; t += step) {
    if (keyAt(t) === nextYmd) {
      second = t;
      break;
    }
  }
  if (second < 0) {
    const end = first + 24 * 3600 * 1000;
    return { startIso: new Date(first).toISOString(), endIso: new Date(end).toISOString() };
  }
  while (second > loN && keyAt(second - 1) === nextYmd) second -= 1;
  while (keyAt(second) !== nextYmd) second += 1;
  return { startIso: new Date(first).toISOString(), endIso: new Date(second).toISOString() };
}

/** Business "today" as UTC bounds for session queries, matching earnings calendar. */
export function businessTodayUtcRange(now: Date, timeZone: string): { startIso: string; endIso: string } {
  const { iso } = calendarYmdInTimeZone(now, timeZone);
  return utcHalfOpenRangeForCalendarDateInZone(iso, timeZone);
}
