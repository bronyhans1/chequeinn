import * as payrollRepo from "./payroll.repository";
import * as wageRepo from "../wageRates/wageRates.repository";
import * as companyPolicy from "../companyPolicy/companyPolicy.service";
import * as holidaysRepo from "../holidays/holidays.repository";
import * as sessionsRepo from "../sessions/sessions.repository";
import * as attendanceOverrideRepo from "../attendanceDayOverrides/attendanceDayOverrides.repository";
import { WorkSessionStatus } from "../../constants/workSessionStatus";
import {
  aggregateLateMinutesByAttendanceDay,
  classifyAttendanceDayByWorkedMinutes,
  classifyDay,
  computeDailyRate,
  countPayableDivisorDays,
  holidayMap,
  hourlyEquivalentFromDailyRate,
  latePayDeductionFromLateMinutes,
  normalizeAttendanceThresholds,
  normalizeWorkingWeekdays,
  salaryAttendanceDayFromCheckIn,
  type IsoDate,
  type SalaryDivisorType,
} from "./salaryEarnings.engine";
import {
  normalizeBusinessTimeZone,
  yearMonthTodayInTimeZone,
} from "../../lib/businessCalendar";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type DayBreakAgg = { net: number; base: number; late: number };

function mergeBreakIntoDay(
  map: Map<string, DayBreakAgg>,
  dateKey: string | null | undefined,
  r: payrollRepo.PayrollRecord
): void {
  if (!dateKey) return;
  const ed = dateKey.slice(0, 10);
  const br = payrollRepo.payrollRecordEarningsBreakdown(r);
  const prev = map.get(ed) ?? { net: 0, base: 0, late: 0 };
  map.set(ed, {
    net: round2(prev.net + br.net),
    base: round2(prev.base + br.baseBeforeLate),
    late: round2(prev.late + br.lateDeduction),
  });
}

export async function syncMonthlySalaryPayroll(
  userId: string,
  companyId: string,
  year: number,
  month: number
): Promise<void> {
  const payrollOn = await companyPolicy.isPayrollEnabled(companyId);
  if (!payrollOn) return;

  /**
   * Session query window: `[monthStartUtc, nextMonthStartUtc)` so every included session has check_in in this
   * `(year, month)` or earlier; combined with `salaryAttendanceDayFromCheckIn`, rows cannot be double-counted across
   * months (see engine JSDoc).
   */
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const asOf = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const wage = await wageRepo.getEffectiveWageRow(userId, companyId, asOf);
  if (!wage || wage.rate_type !== "monthly" || !wage.monthly_salary || wage.monthly_salary <= 0) {
    await payrollRepo.deleteSalaryDailyForUserMonth(userId, companyId, year, month).catch(() => undefined);
    return;
  }

  const policy = await companyPolicy.getPolicy(companyId);
  const workingWeekdays = normalizeWorkingWeekdays(
    (policy as { working_weekdays?: unknown }).working_weekdays
  );
  const thresholds = normalizeAttendanceThresholds({
    minimum_minutes_for_counted_day: (policy as any).minimum_minutes_for_counted_day,
    full_day_minutes_threshold: (policy as any).full_day_minutes_threshold,
    default_daily_hours: (policy as any).default_daily_hours,
  });
  const classificationEnabled =
    (policy as { attendance_day_classification_enabled?: unknown }).attendance_day_classification_enabled === true;

  const holRows = await holidaysRepo.listHolidaysForCompanyRange(
    companyId,
    `${year}-${String(month).padStart(2, "0")}-01`,
    asOf
  );
  const hmap = holidayMap(
    holRows.map((h) => ({ date: h.holiday_date.slice(0, 10), is_paid: h.is_paid }))
  );

  const divisorDays = countPayableDivisorDays(year, month, workingWeekdays, hmap);
  const dynamicCount = divisorDays.length;
  const divType = (wage.salary_divisor_type as SalaryDivisorType) ?? "dynamic_working_days";
  const dailyRate = computeDailyRate(
    wage.monthly_salary,
    divType,
    wage.salary_divisor_value,
    dynamicCount
  );

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const startIso = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const endIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;

  const { rows: sessions } = await sessionsRepo.listSessionsForUser(userId, companyId, {
    startIso,
    endIso,
    limit: 2000,
    offset: 0,
  });
  const startYmd = `${year}-${String(month).padStart(2, "0")}-01`;
  const endYmd = asOf;
  const overrides = await attendanceOverrideRepo.listForUserRange(companyId, userId, startYmd, endYmd);
  const overrideUnitsByDay = new Map<string, number>();
  for (const o of overrides) {
    overrideUnitsByDay.set(o.attendance_date.slice(0, 10), Number(o.day_units));
  }

  const workedMinutesByDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.check_in || s.status !== WorkSessionStatus.COMPLETED) continue;
    const k = salaryAttendanceDayFromCheckIn(s.check_in);
    const mins =
      typeof (s as any).duration_minutes === "number" && (s as any).duration_minutes >= 0
        ? (s as any).duration_minutes
        : s.check_out
          ? Math.floor((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000)
          : 0;
    workedMinutesByDay.set(k, (workedMinutesByDay.get(k) ?? 0) + Math.max(0, mins));
  }

  const lateByDay = aggregateLateMinutesByAttendanceDay(sessions);
  const applyLatePayDed = await companyPolicy.isLatePayDeductionEnabled(companyId);
  const defaultDailyHours = Math.max(1, Math.min(24, policy.default_daily_hours ?? 8));

  await payrollRepo.deleteSalaryDailyForUserMonth(userId, companyId, year, month);

  const dim = lastDay;
  for (let d = 1; d <= dim; d++) {
    const iso: IsoDate = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const c = classifyDay(iso, workingWeekdays, hmap);
    let gross = 0;
    let grossBeforeLate: number | null = null;
    let lateDedAmount: number | null = null;
    if (c.kind === "paid_holiday") {
      gross = dailyRate;
    } else if (c.kind === "working_day") {
      const mins = workedMinutesByDay.get(iso) ?? 0;
      const overrideUnits = overrideUnitsByDay.get(iso);
      const dayUnits =
        overrideUnits !== undefined
          ? overrideUnits
          : classificationEnabled
            ? classifyAttendanceDayByWorkedMinutes(mins, thresholds).day_units
            : mins > 0
              ? 1
              : 0;
      if (dayUnits > 0) gross = Math.round((dailyRate * dayUnits) * 100) / 100;
    }
    if (gross > 0 && applyLatePayDed) {
      const lateM = lateByDay.get(iso) ?? 0;
      if (lateM > 0) {
        grossBeforeLate = Math.round(gross * 100) / 100;
        const hourlyEq = hourlyEquivalentFromDailyRate(dailyRate, defaultDailyHours);
        const ded = latePayDeductionFromLateMinutes(lateM, hourlyEq);
        lateDedAmount = ded;
        gross = Math.max(0, Math.round((gross - ded) * 100) / 100);
      }
    }
    if (gross > 0) {
      await payrollRepo.insertSalaryDailyRecord({
        user_id: userId,
        company_id: companyId,
        earnings_date: iso,
        gross_earnings: gross,
        daily_rate: dailyRate,
        gross_before_late_deduction: grossBeforeLate,
        late_deduction_amount: lateDedAmount,
      });
    }
  }
}

export async function syncSalaryMonthForUserIfMonthly(
  userId: string,
  companyId: string,
  checkInIso: string
): Promise<void> {
  const ymd = salaryAttendanceDayFromCheckIn(checkInIso);
  const [y, m] = ymd.split("-").map(Number);
  const wage = await wageRepo.getEffectiveWageRow(userId, companyId, ymd);
  if (!wage || wage.rate_type !== "monthly") return;
  await syncMonthlySalaryPayroll(userId, companyId, y, m);
}

export interface EarningsSummaryDto {
  rate_type: "hourly" | "monthly" | "none";
  monthly_salary: number | null;
  expected_monthly_salary: number | null;
  daily_rate: number | null;
  payable_days_in_month: number;
  /** Salary only: paid day equivalents (full=1, half=0.5). */
  paid_days: number;
  /** Salary only: unpaid day equivalents (working days not credited up to today). */
  unpaid_days: number;
  today_earned: number;
  /** Base / payable before late deduction (derived or stored). */
  today_base_before_late: number;
  today_late_deduction: number;
  month_earned_total: number;
  month_base_before_late: number;
  month_late_deduction_total: number;
  month_earned_salary_daily: number;
  month_earned_hourly: number;
  divisor_type: string | null;
  /** IANA zone from company policy (fallback UTC). */
  business_timezone: string;
  /** Company-local calendar date used as "today" for this summary. */
  calendar_today: string;
  /** Short explanation for UI (truthful vs device-local midnight). */
  earnings_period_label: string;
  /** Thresholds used to classify a completed day for salary credit. */
  attendance_thresholds: {
    minimum_minutes_for_counted_day: number;
    full_day_minutes_threshold: number;
  };
  attendance_day_classification_enabled: boolean;
  daily_history: Array<{
    date: string;
    gross: number;
    record_type: string;
    base_before_late: number;
    late_deduction: number;
  }>;
}

function earningsCalendarMeta(
  tzInput: string,
  todayIso: IsoDate
): Pick<
  EarningsSummaryDto,
  "business_timezone" | "calendar_today" | "earnings_period_label"
> {
  const business_timezone = normalizeBusinessTimeZone(tzInput);
  return {
    business_timezone,
    calendar_today: todayIso,
    earnings_period_label: `Earnings use your company calendar (${business_timezone}). Calendar date: ${todayIso}.`,
  };
}

function earningsThresholdMeta(th: { min: number; full: number }): Pick<EarningsSummaryDto, "attendance_thresholds"> {
  return {
    attendance_thresholds: {
      minimum_minutes_for_counted_day: th.min,
      full_day_minutes_threshold: th.full,
    },
  };
}

/** Recompute salary-daily rows for the month, then return dashboard numbers. */
export async function getEarningsSummary(
  userId: string,
  companyId: string,
  year: number,
  month: number,
  todayIso: IsoDate,
  businessTimezone: string
): Promise<EarningsSummaryDto> {
  const tz = normalizeBusinessTimeZone(businessTimezone);

  const payrollOn = await companyPolicy.isPayrollEnabled(companyId);
  if (!payrollOn) {
    return emptySummary("none", tz, todayIso);
  }

  const wage = await wageRepo.getEffectiveWageRow(userId, companyId, todayIso);
  if (!wage) {
    return emptySummary("none", tz, todayIso);
  }

  const policyBase = await companyPolicy.getPolicy(companyId);
  const thresholdsBase = normalizeAttendanceThresholds({
    minimum_minutes_for_counted_day: (policyBase as { minimum_minutes_for_counted_day?: unknown }).minimum_minutes_for_counted_day,
    full_day_minutes_threshold: (policyBase as { full_day_minutes_threshold?: unknown }).full_day_minutes_threshold,
    default_daily_hours: (policyBase as { default_daily_hours?: unknown }).default_daily_hours,
  });
  const classificationEnabledBase =
    (policyBase as { attendance_day_classification_enabled?: unknown }).attendance_day_classification_enabled === true;

  if (wage.rate_type !== "monthly") {
    const records = await payrollRepo.getPayrollByUserMonth(userId, companyId, year, month);
    let month_earned_hourly = 0;
    let month_base_before_late = 0;
    let month_late_deduction_total = 0;
    const byDateDetail = new Map<string, DayBreakAgg>();
    for (const r of records) {
      const rt = r.record_type ?? "session_hourly";
      if (typeof r.gross_earnings !== "number") continue;
      if (rt === "salary_daily") continue;
      const br = payrollRepo.payrollRecordEarningsBreakdown(r);
      month_earned_hourly += r.gross_earnings;
      month_base_before_late = round2(month_base_before_late + br.baseBeforeLate);
      month_late_deduction_total = round2(month_late_deduction_total + br.lateDeduction);
      mergeBreakIntoDay(byDateDetail, r.payroll_date, r);
    }
    const daily_history: EarningsSummaryDto["daily_history"] = [];
    for (const [date, agg] of [...byDateDetail.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
      daily_history.push({
        date,
        gross: agg.net,
        record_type: "session_hourly",
        base_before_late: agg.base,
        late_deduction: agg.late,
      });
    }
    const todayAgg = byDateDetail.get(todayIso);
    return {
      rate_type: "hourly",
      monthly_salary: null,
      expected_monthly_salary: null,
      daily_rate: null,
      payable_days_in_month: 0,
      paid_days: 0,
      unpaid_days: 0,
      today_earned: todayAgg ? todayAgg.net : 0,
      today_base_before_late: todayAgg?.base ?? 0,
      today_late_deduction: todayAgg?.late ?? 0,
      month_earned_total: round2(month_earned_hourly),
      month_base_before_late,
      month_late_deduction_total,
      month_earned_salary_daily: 0,
      month_earned_hourly: round2(month_earned_hourly),
      divisor_type: null,
      daily_history: daily_history.slice(0, 62),
      ...earningsCalendarMeta(tz, todayIso),
      ...earningsThresholdMeta(thresholdsBase),
      attendance_day_classification_enabled: classificationEnabledBase,
    };
  }

  if (!wage.monthly_salary || wage.monthly_salary <= 0) {
    return emptySummary("none", tz, todayIso);
  }

  await syncMonthlySalaryPayroll(userId, companyId, year, month);

  const policy = policyBase;
  const workingWeekdays = normalizeWorkingWeekdays(
    (policy as { working_weekdays?: unknown }).working_weekdays
  );
  const thresholds = thresholdsBase;
  const classificationEnabled = classificationEnabledBase;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const holRows = await holidaysRepo.listHolidaysForCompanyRange(
    companyId,
    `${year}-${String(month).padStart(2, "0")}-01`,
    monthEnd
  );
  const hmap = holidayMap(
    holRows.map((h) => ({ date: h.holiday_date.slice(0, 10), is_paid: h.is_paid }))
  );

  const divisorList = countPayableDivisorDays(year, month, workingWeekdays, hmap);
  const dynamicCount = divisorList.length;

  let dailyRate: number | null = null;
  let monthlySalary: number | null = null;
  let divType: string | null = null;

  if (wage.rate_type === "monthly" && wage.monthly_salary) {
    monthlySalary = wage.monthly_salary;
    divType = wage.salary_divisor_type;
    dailyRate = computeDailyRate(
      wage.monthly_salary,
      (wage.salary_divisor_type as SalaryDivisorType) ?? "dynamic_working_days",
      wage.salary_divisor_value,
      dynamicCount
    );
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const startIso = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const endIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;

  const { rows: sessions } = await sessionsRepo.listSessionsForUser(userId, companyId, {
    startIso,
    endIso,
    limit: 2000,
    offset: 0,
  });
  const startYmd = `${year}-${String(month).padStart(2, "0")}-01`;
  const endYmd = monthEnd;
  const overrides = await attendanceOverrideRepo.listForUserRange(companyId, userId, startYmd, endYmd);
  const overrideUnitsByDay = new Map<string, number>();
  for (const o of overrides) {
    overrideUnitsByDay.set(o.attendance_date.slice(0, 10), Number(o.day_units));
  }
  const workedMinutesByDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.check_in || s.status !== WorkSessionStatus.COMPLETED) continue;
    const k = salaryAttendanceDayFromCheckIn(s.check_in);
    const mins =
      typeof (s as any).duration_minutes === "number" && (s as any).duration_minutes >= 0
        ? (s as any).duration_minutes
        : s.check_out
          ? Math.floor((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000)
          : 0;
    workedMinutesByDay.set(k, (workedMinutesByDay.get(k) ?? 0) + Math.max(0, mins));
  }

  const lateByDaySummary = aggregateLateMinutesByAttendanceDay(sessions);
  const applyLatePayDedSummary = await companyPolicy.isLatePayDeductionEnabled(companyId);
  const defaultHSummary = Math.max(1, Math.min(24, policy.default_daily_hours ?? 8));

  let paid_days = 0;
  let unpaid_days = 0;
  for (let d = 1; d <= lastDay; d++) {
    const iso: IsoDate = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso > todayIso) break;
    const c = classifyDay(iso, workingWeekdays, hmap);
    if (c.kind === "paid_holiday") {
      paid_days += 1;
    } else if (c.kind === "working_day") {
      const mins = workedMinutesByDay.get(iso) ?? 0;
      const overrideUnits = overrideUnitsByDay.get(iso);
      const clsUnits =
        overrideUnits !== undefined
          ? overrideUnits
          : classificationEnabled
            ? classifyAttendanceDayByWorkedMinutes(mins, thresholds).day_units
            : mins > 0
              ? 1
              : 0;
      if (clsUnits > 0) paid_days += clsUnits;
      else unpaid_days += 1;
    }
  }

  const records = await payrollRepo.getPayrollByUserMonth(userId, companyId, year, month);
  let month_earned_salary_daily = 0;
  let month_earned_hourly = 0;
  let month_base_before_late = 0;
  let month_late_deduction_total = 0;
  const daily_history: EarningsSummaryDto["daily_history"] = [];

  const byDateDetail = new Map<string, DayBreakAgg>();

  for (const r of records) {
    const rt = r.record_type ?? "session_hourly";
    if (typeof r.gross_earnings !== "number") continue;
    const br = payrollRepo.payrollRecordEarningsBreakdown(r);
    month_base_before_late = round2(month_base_before_late + br.baseBeforeLate);
    month_late_deduction_total = round2(month_late_deduction_total + br.lateDeduction);
    if (rt === "salary_daily") {
      month_earned_salary_daily += r.gross_earnings;
      mergeBreakIntoDay(byDateDetail, r.earnings_date ?? r.payroll_date, r);
    } else {
      month_earned_hourly += r.gross_earnings;
      mergeBreakIntoDay(byDateDetail, r.payroll_date, r);
    }
  }

  let today_earned = 0;
  let today_base_before_late = 0;
  let today_late_deduction = 0;
  const todayFromRecords = byDateDetail.get(todayIso);

  if (todayFromRecords !== undefined) {
    today_earned = todayFromRecords.net;
    today_base_before_late = todayFromRecords.base;
    today_late_deduction = todayFromRecords.late;
  } else if (wage.rate_type === "monthly" && dailyRate !== null) {
    const c = classifyDay(todayIso, workingWeekdays, hmap);
    if (c.kind === "paid_holiday") {
      today_base_before_late = dailyRate;
      today_earned = dailyRate;
    } else if (c.kind === "working_day") {
      const mins = workedMinutesByDay.get(todayIso) ?? 0;
      const overrideUnits = overrideUnitsByDay.get(todayIso);
      const clsUnits =
        overrideUnits !== undefined
          ? overrideUnits
          : classificationEnabled
            ? classifyAttendanceDayByWorkedMinutes(mins, thresholds).day_units
            : mins > 0
              ? 1
              : 0;
      if (clsUnits > 0) {
        today_base_before_late = Math.round((dailyRate * clsUnits) * 100) / 100;
        today_earned = today_base_before_late;
      }
      if (applyLatePayDedSummary) {
        const lateM = lateByDaySummary.get(todayIso) ?? 0;
        if (lateM > 0) {
          const hourlyEq = hourlyEquivalentFromDailyRate(dailyRate, defaultHSummary);
          const ded = latePayDeductionFromLateMinutes(lateM, hourlyEq);
          today_late_deduction = ded;
          today_earned = Math.max(0, round2(today_earned - ded));
        }
      }
    }
  }

  for (const [date, agg] of [...byDateDetail.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    daily_history.push({
      date,
      gross: agg.net,
      record_type: "mixed",
      base_before_late: agg.base,
      late_deduction: agg.late,
    });
  }

  const month_earned_total =
    Math.round((month_earned_salary_daily + month_earned_hourly) * 100) / 100;

  return {
    rate_type: wage.rate_type,
    monthly_salary: monthlySalary,
    expected_monthly_salary: monthlySalary,
    daily_rate: dailyRate,
    payable_days_in_month: dynamicCount,
    paid_days,
    unpaid_days,
    today_earned: round2(today_earned),
    today_base_before_late: round2(today_base_before_late),
    today_late_deduction: round2(today_late_deduction),
    month_earned_total,
    month_base_before_late,
    month_late_deduction_total,
    month_earned_salary_daily: Math.round(month_earned_salary_daily * 100) / 100,
    month_earned_hourly: Math.round(month_earned_hourly * 100) / 100,
    divisor_type: divType,
    daily_history: daily_history.slice(0, 62),
    ...earningsCalendarMeta(tz, todayIso),
    ...earningsThresholdMeta(thresholds),
    attendance_day_classification_enabled: classificationEnabled,
  };
}

function emptySummary(
  rate: "hourly" | "monthly" | "none",
  tz: string,
  todayIso: IsoDate
): EarningsSummaryDto {
  return {
    rate_type: rate,
    monthly_salary: null,
    expected_monthly_salary: null,
    daily_rate: null,
    payable_days_in_month: 0,
    paid_days: 0,
    unpaid_days: 0,
    today_earned: 0,
    today_base_before_late: 0,
    today_late_deduction: 0,
    month_earned_total: 0,
    month_base_before_late: 0,
    month_late_deduction_total: 0,
    month_earned_salary_daily: 0,
    month_earned_hourly: 0,
    divisor_type: null,
    daily_history: [],
    ...earningsCalendarMeta(tz, todayIso),
    ...earningsThresholdMeta({ min: 60, full: 480 }),
    attendance_day_classification_enabled: false,
  };
}

/** Current calendar month in the company's configured timezone. */
export async function getCurrentEarningsSummary(
  userId: string,
  companyId: string
): Promise<EarningsSummaryDto> {
  const pol = await companyPolicy.getPolicy(companyId);
  const tzRaw = (pol as { business_timezone?: string | null }).business_timezone;
  const { year, month, todayIso } = yearMonthTodayInTimeZone(new Date(), tzRaw ?? "UTC");
  return getEarningsSummary(userId, companyId, year, month, todayIso, tzRaw ?? "UTC");
}
