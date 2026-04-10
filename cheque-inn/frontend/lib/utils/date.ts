/** Format YYYY-MM-DD for date inputs. */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Start and end of current month as YYYY-MM-DD. */
export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateString(start), end: toDateString(end) };
}

/** Calendar presets for report date ranges (local date, matches `<input type="date">`). */
export type ReportDatePresetId = "this_month" | "last_month" | "last_7_days";

export function applyReportDatePresetRange(preset: ReportDatePresetId): {
  start: string;
  end: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "this_month":
      return getCurrentMonthRange();
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toDateString(start), end: toDateString(end) };
    }
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: toDateString(start), end: toDateString(today) };
    }
  }
}

/** Year + month (1–12) for payroll month pickers. */
export function getYearMonthPreset(preset: "this_month" | "last_month"): {
  year: number;
  month: number;
} {
  const now = new Date();
  if (preset === "this_month") {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
