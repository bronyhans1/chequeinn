/** Pure helpers for shift list/modal display (Sprint 3). */

export function parseHmToMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatMinutesHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isOvernightWallClockSpan(startTime: string, endTime: string): boolean {
  const s = parseHmToMinutes(startTime);
  const e = parseHmToMinutes(endTime);
  if (s === null || e === null) return false;
  return e <= s;
}

export function formatShiftTimeRange(params: {
  start_time: string;
  end_time: string;
  spans_midnight?: boolean;
}): string {
  const start = params.start_time?.slice(0, 5) ?? "—";
  const end = params.end_time?.slice(0, 5) ?? "—";
  const overnight =
    params.spans_midnight === true || isOvernightWallClockSpan(start, end);
  if (overnight) {
    return `${start} → ${end} (next day)`;
  }
  return `${start} → ${end}`;
}

export function clientValidateShiftTimes(params: {
  start_time: string;
  end_time: string;
  overnight_shifts_enabled: boolean;
}): string | null {
  const s = parseHmToMinutes(params.start_time);
  const e = parseHmToMinutes(params.end_time);
  if (s === null || e === null) return "Invalid time format.";
  if (s === e) return "Start and end times must differ.";
  if (!params.overnight_shifts_enabled && e <= s) {
    return "End time must be after start time on the same calendar day, or enable overnight shifts in Settings.";
  }
  return null;
}

export function filterShiftsForList<T extends { is_active?: boolean | null }>(
  rows: T[],
  showInactive: boolean
): T[] {
  if (showInactive) return rows;
  return rows.filter((r) => r.is_active !== false);
}
