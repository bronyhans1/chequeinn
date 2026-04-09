/**
 * Pure policy helpers for monthly salary daily rate and payable-day classification.
 * Weekdays: ISO-style 1 = Monday … 7 = Sunday.
 */

import { WorkSessionStatus } from "../../constants/workSessionStatus";

export type IsoDate = string;

export type SalaryDivisorType = "dynamic_working_days" | "fixed_days";

export type DayClassification =
  | { kind: "unpaid_holiday" }
  | { kind: "paid_holiday" }
  | { kind: "working_day" }
  | { kind: "rest_day" };

export type AttendanceDayPayClass =
  | { kind: "not_counted"; day_units: 0 }
  | { kind: "half_day"; day_units: 0.5 }
  | { kind: "full_day"; day_units: 1 };

export function normalizeAttendanceThresholds(input: {
  minimum_minutes_for_counted_day?: unknown;
  full_day_minutes_threshold?: unknown;
  default_daily_hours?: unknown;
}): { min: number; full: number } {
  const defHours =
    typeof input.default_daily_hours === "number" && Number.isFinite(input.default_daily_hours)
      ? input.default_daily_hours
      : 8;
  const defaultFull = Math.max(0, Math.min(1440, Math.round(defHours * 60)));
  const minRaw = typeof input.minimum_minutes_for_counted_day === "number" ? input.minimum_minutes_for_counted_day : 60;
  const fullRaw = typeof input.full_day_minutes_threshold === "number" ? input.full_day_minutes_threshold : defaultFull || 480;
  const clampInt = (n: number) => Math.max(0, Math.min(1440, Math.round(n)));
  let min = clampInt(minRaw);
  let full = clampInt(fullRaw);
  if (full < min) full = min;
  return { min, full };
}

/**
 * Company policy: classify a calendar day for monthly salary credit by completed worked minutes.
 * (Incomplete sessions are excluded upstream; this is duration-based only.)
 */
export function classifyAttendanceDayByWorkedMinutes(
  workedMinutes: number,
  thresholds: { min: number; full: number }
): AttendanceDayPayClass {
  const m = Number.isFinite(workedMinutes) ? Math.max(0, Math.floor(workedMinutes)) : 0;
  if (m < thresholds.min) return { kind: "not_counted", day_units: 0 };
  if (m >= thresholds.full) return { kind: "full_day", day_units: 1 };
  // Less-harsh model: any minutes >= min but below full count as half-day.
  return { kind: "half_day", day_units: 0.5 };
}

/** Monday=1 … Sunday=7 from YYYY-MM-DD (UTC). */
export function utcWeekdayMon1Sun7(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const js = dt.getUTCDay();
  return js === 0 ? 7 : js;
}

export function normalizeWorkingWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) return [1, 2, 3, 4, 5];
  const nums = raw
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const uniq = [...new Set(nums)].sort((a, b) => a - b);
  return uniq.length ? uniq : [1, 2, 3, 4, 5];
}

export function isWorkingWeekday(iso: IsoDate, workingWeekdays: number[]): boolean {
  return workingWeekdays.includes(utcWeekdayMon1Sun7(iso));
}

export type HolidayDef = { date: IsoDate; is_paid: boolean };

export function holidayMap(holidays: HolidayDef[]): Map<IsoDate, { is_paid: boolean }> {
  const m = new Map<IsoDate, { is_paid: boolean }>();
  for (const h of holidays) {
    m.set(h.date, { is_paid: h.is_paid });
  }
  return m;
}

export function classifyDay(
  iso: IsoDate,
  workingWeekdays: number[],
  holidays: Map<IsoDate, { is_paid: boolean }>
): DayClassification {
  const h = holidays.get(iso);
  if (h) {
    return h.is_paid ? { kind: "paid_holiday" } : { kind: "unpaid_holiday" };
  }
  if (isWorkingWeekday(iso, workingWeekdays)) return { kind: "working_day" };
  return { kind: "rest_day" };
}

/** Days included in salary divisor for the month (paid holidays + scheduled working days, excluding unpaid holidays). */
export function countPayableDivisorDays(
  year: number,
  month: number,
  workingWeekdays: number[],
  holidays: Map<IsoDate, { is_paid: boolean }>
): IsoDate[] {
  const list: IsoDate[] = [];
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const c = classifyDay(iso, workingWeekdays, holidays);
    if (c.kind === "paid_holiday" || c.kind === "working_day") list.push(iso);
  }
  return list;
}

export function computeDailyRate(
  monthlySalary: number,
  divisorType: SalaryDivisorType,
  divisorValue: number,
  dynamicPayableDayCount: number
): number {
  const denom =
    divisorType === "fixed_days"
      ? Math.max(1, divisorValue)
      : Math.max(1, dynamicPayableDayCount);
  return Math.round((monthlySalary / denom) * 100) / 100;
}

export function ymTodayUtc(): { year: number; month: number; todayIso: IsoDate } {
  const n = new Date();
  const year = n.getUTCFullYear();
  const month = n.getUTCMonth() + 1;
  const day = n.getUTCDate();
  const todayIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, todayIso };
}

/** Calendar month (UTC) for a YYYY-MM-DD string. */
export function utcYearMonthFromCalendarDate(iso: IsoDate): { year: number; month: number } {
  const d = iso.slice(0, 10);
  const [y, m] = d.split("-").map(Number);
  return { year: y, month: m };
}

export function previousUtcYearMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export type YearMonth = { year: number; month: number };

export function dedupeYearMonths(months: YearMonth[]): YearMonth[] {
  const seen = new Set<string>();
  const out: YearMonth[] = [];
  for (const { year, month } of months) {
    const k = `${year}-${month}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ year, month });
  }
  return out;
}

export function mergeYearMonthLists(...lists: YearMonth[][]): YearMonth[] {
  return dedupeYearMonths(lists.flat());
}

/**
 * Salary-day ownership for monthly earners (UTC):
 *
 * A completed work session counts toward **at most one** salary calendar day: the UTC calendar date of **check-in**
 * (`check_in` ISO timestamp → `YYYY-MM-DD`). Check-out is ignored for day assignment.
 *
 * - **Overnight shifts**: if check-in is Mar 31 22:00Z and check-out is Apr 1 06:00Z, the day credited is **Mar 31**
 *   (all gross for that shift lives in March’s bucket). There is **no** duplicate credit in April from the same session.
 * - **Month boundaries**: `syncMonthlySalaryPayroll` loads sessions with `check_in` in `[monthStart, nextMonthStart)`;
 *   sessions are included in the month that owns their check-in date, so a March-night shift does not leak into
 *   April rows.
 *
 * `salary_daily` rows set `earnings_date` and `payroll_date` to the same calendar day (paid holiday or working day).
 */
export function salaryAttendanceDayFromCheckIn(checkInIso: string): IsoDate {
  return checkInIso.slice(0, 10);
}

/**
 * One late-minutes value per attendance day (UTC check-in date): earliest completed session
 * that recorded lateness wins. Avoids stacking pay impact / summaries when someone clocks
 * in multiple times the same day.
 */
export function aggregateLateMinutesByAttendanceDay(
  sessions: Array<{
    check_in: string | null;
    status: string;
    late_minutes?: number | null;
  }>
): Map<IsoDate, number> {
  type Cand = { checkInMs: number; late: number };
  const best = new Map<IsoDate, Cand>();
  for (const s of sessions) {
    if (!s.check_in || s.status !== WorkSessionStatus.COMPLETED) continue;
    const lm = typeof s.late_minutes === "number" && s.late_minutes > 0 ? s.late_minutes : 0;
    if (lm <= 0) continue;
    const day = salaryAttendanceDayFromCheckIn(s.check_in);
    const checkInMs = new Date(s.check_in).getTime();
    const prev = best.get(day);
    if (!prev || checkInMs < prev.checkInMs) best.set(day, { checkInMs, late: lm });
  }
  const m = new Map<IsoDate, number>();
  for (const [day, v] of best) m.set(day, v.late);
  return m;
}

/**
 * Hourly rate implied by a full working day's pay (monthly daily rate ÷ default daily hours).
 * Used to value late minutes for monthly earners consistently with hourly workers.
 */
export function hourlyEquivalentFromDailyRate(
  dailyRate: number,
  defaultDailyHours: number
): number {
  const h = Math.max(1e-6, defaultDailyHours);
  return dailyRate / h;
}

/** Currency amount for late minutes at the given hourly rate (or daily-rate hourly equivalent). */
export function latePayDeductionFromLateMinutes(
  lateMinutes: number,
  hourlyRateOrEquivalent: number
): number {
  const lm = Math.max(0, lateMinutes);
  if (lm <= 0 || hourlyRateOrEquivalent <= 0) return 0;
  return Math.round(((lm / 60) * hourlyRateOrEquivalent) * 100) / 100;
}
