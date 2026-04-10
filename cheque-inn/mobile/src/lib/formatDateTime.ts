/**
 * Format instants in the company's business timezone so mobile matches web/earnings
 * and avoids device-default locale quirks for UTC / Africa/Accra on some engines.
 */

export function normalizeZoneForIntl(tz: string | null | undefined): string {
  const z = (tz ?? "UTC").trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return "UTC";
  }
}

export function formatSessionClock(iso: string | null | undefined, businessTimeZone?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeZoneForIntl(businessTimeZone);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatSessionDay(iso: string | null | undefined, businessTimeZone?: string | null): string {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeZoneForIntl(businessTimeZone);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return "—";
  }
}

/** Hour (0–23) in the business zone, for greetings / copy tied to company calendar. */
export function formatBusinessTimeOnly(isoOrNow: string | Date, businessTimeZone?: string | null): string {
  const d = typeof isoOrNow === "string" ? new Date(isoOrNow) : isoOrNow;
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeZoneForIntl(businessTimeZone);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function currentHourInBusinessZone(now: Date, businessTimeZone?: string | null): number {
  const tz = normalizeZoneForIntl(businessTimeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    return Number.isFinite(h) ? h : now.getHours();
  } catch {
    return now.getHours();
  }
}
