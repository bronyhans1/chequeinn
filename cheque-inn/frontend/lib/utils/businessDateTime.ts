/**
 * Display instants in the company's business timezone (IANA).
 * Backend stores UTC ISO strings; UI must not use the browser's local zone for business times.
 */

export const DEFAULT_BUSINESS_TIMEZONE = "Africa/Accra";

export function normalizeBusinessTimeZone(tz: string | null | undefined): string {
  const z = (tz ?? DEFAULT_BUSINESS_TIMEZONE).trim() || DEFAULT_BUSINESS_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
}

function calendarDateKeyInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeBusinessTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Calendar date in business zone (no time-of-day). */
export function formatBusinessDateOnly(
  iso: string | null | undefined,
  businessTimeZone?: string | null
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeBusinessTimeZone(businessTimeZone);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/** Session / audit timestamp — matches mobile `formatSessionClock`. */
export function formatBusinessDateTime(
  iso: string | null | undefined,
  businessTimeZone?: string | null
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeBusinessTimeZone(businessTimeZone);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).format(d);
  } catch {
    return iso;
  }
}

/** Relative-friendly label for dashboard activity (Today / Yesterday in business zone). */
export function formatBusinessFriendlyDateTime(
  iso: string | null | undefined,
  businessTimeZone?: string | null
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeBusinessTimeZone(businessTimeZone);
  const now = new Date();
  const dayKey = calendarDateKeyInZone(d, tz);
  const todayKey = calendarDateKeyInZone(now, tz);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = calendarDateKeyInZone(yesterday, tz);

  let time: string;
  try {
    time = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    time = formatBusinessDateTime(iso, tz);
  }

  if (dayKey === todayKey) return `Today at ${time}`;
  if (dayKey === yesterdayKey) return `Yesterday at ${time}`;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return formatBusinessDateTime(iso, tz);
  }
}
