import * as repo from "./companyPolicy.repository";
import { normalizeWorkingWeekdays } from "../payroll/salaryEarnings.engine";
import { normalizeBusinessTimeZone } from "../../lib/businessCalendar";

export interface UpdatePolicyInput {
  default_daily_hours?: number;
  overtime_multiplier?: number;
  lateness_tracking_enabled?: boolean;
  late_pay_deduction_enabled?: boolean;
  payroll_enabled?: boolean;
  /** IANA timezone, e.g. Africa/Accra */
  business_timezone?: string;
  attendance_day_classification_enabled?: boolean;
  minimum_minutes_for_counted_day?: number;
  full_day_minutes_threshold?: number;
  currency_code?: string;
  working_weekdays?: unknown;
}

/** Whether payroll / wage / earnings features are active for the company (default true). */
export async function isPayrollEnabled(companyId: string): Promise<boolean> {
  const policy = await getPolicy(companyId);
  const v = (policy as { payroll_enabled?: boolean }).payroll_enabled;
  return v !== false;
}

/** When false, late_minutes are not stored (forced to 0 at clock-in). Default true. */
export async function isLatenessTrackingEnabled(companyId: string): Promise<boolean> {
  const policy = await getPolicy(companyId);
  return policy.lateness_tracking_enabled !== false;
}

/**
 * Late minutes reduce gross pay only when payroll is on and this flag is true.
 */
export async function isLatePayDeductionEnabled(companyId: string): Promise<boolean> {
  if (!(await isPayrollEnabled(companyId))) return false;
  const policy = await getPolicy(companyId);
  return policy.late_pay_deduction_enabled === true;
}

function normalizeCurrencyCode(raw: unknown): "GHS" | "USD" | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toUpperCase();
  if (v === "GHS" || v === "USD") return v;
  return undefined;
}

export async function getPolicy(
  companyId: string
): Promise<repo.CompanyPolicyRecord> {
  let policy = await repo.getPolicyByCompany(companyId);
  if (!policy) {
    policy = await repo.createPolicy(companyId, {});
  }
  return {
    ...policy,
    lateness_tracking_enabled: policy.lateness_tracking_enabled ?? true,
    late_pay_deduction_enabled: policy.late_pay_deduction_enabled ?? false,
    business_timezone: normalizeBusinessTimeZone(
      (policy as { business_timezone?: string | null }).business_timezone
    ),
  };
}

export async function updatePolicy(
  companyId: string,
  data: UpdatePolicyInput
): Promise<{ data: repo.CompanyPolicyRecord | null; error?: string }> {
  let policy = await repo.getPolicyByCompany(companyId);
  if (!policy) {
    policy = await repo.createPolicy(companyId, {});
  }

  if (
    data.default_daily_hours !== undefined &&
    (data.default_daily_hours < 1 || data.default_daily_hours > 24)
  ) {
    return { data: null, error: "default_daily_hours must be between 1 and 24" };
  }
  if (
    data.overtime_multiplier !== undefined &&
    (data.overtime_multiplier < 1 || data.overtime_multiplier > 3)
  ) {
    return {
      data: null,
      error: "overtime_multiplier must be between 1 and 3",
    };
  }

  let workingWeekdaysPayload: unknown | undefined;
  if (data.working_weekdays !== undefined) {
    workingWeekdaysPayload = normalizeWorkingWeekdays(data.working_weekdays);
  }

  if (data.payroll_enabled !== undefined && typeof data.payroll_enabled !== "boolean") {
    return { data: null, error: "payroll_enabled must be a boolean" };
  }
  if (
    data.lateness_tracking_enabled !== undefined &&
    typeof data.lateness_tracking_enabled !== "boolean"
  ) {
    return { data: null, error: "lateness_tracking_enabled must be a boolean" };
  }
  if (
    data.late_pay_deduction_enabled !== undefined &&
    typeof data.late_pay_deduction_enabled !== "boolean"
  ) {
    return { data: null, error: "late_pay_deduction_enabled must be a boolean" };
  }

  let businessTimezonePayload: string | undefined;
  if (data.business_timezone !== undefined) {
    if (typeof data.business_timezone !== "string" || !data.business_timezone.trim()) {
      return { data: null, error: "business_timezone must be a non-empty string" };
    }
    businessTimezonePayload = normalizeBusinessTimeZone(data.business_timezone.trim());
  }

  if (
    data.attendance_day_classification_enabled !== undefined &&
    typeof data.attendance_day_classification_enabled !== "boolean"
  ) {
    return { data: null, error: "attendance_day_classification_enabled must be a boolean" };
  }

  const minM =
    data.minimum_minutes_for_counted_day !== undefined
      ? Number(data.minimum_minutes_for_counted_day)
      : undefined;
  const fullM =
    data.full_day_minutes_threshold !== undefined
      ? Number(data.full_day_minutes_threshold)
      : undefined;

  function isIntInRange(v: number, min: number, max: number): boolean {
    return Number.isInteger(v) && v >= min && v <= max;
  }

  if (minM !== undefined && !isIntInRange(minM, 0, 1440)) {
    return { data: null, error: "minimum_minutes_for_counted_day must be an integer 0-1440" };
  }
  if (fullM !== undefined && !isIntInRange(fullM, 0, 1440)) {
    return { data: null, error: "full_day_minutes_threshold must be an integer 0-1440" };
  }

  const effectiveMin = minM !== undefined ? minM : policy.minimum_minutes_for_counted_day;
  const effectiveFull = fullM !== undefined ? fullM : policy.full_day_minutes_threshold;
  if (effectiveFull < effectiveMin) {
    return {
      data: null,
      error: "full_day_minutes_threshold must be greater than or equal to minimum_minutes_for_counted_day",
    };
  }

  let currencyPayload: "GHS" | "USD" | undefined;
  if (data.currency_code !== undefined) {
    currencyPayload = normalizeCurrencyCode(data.currency_code);
    if (!currencyPayload) {
      return { data: null, error: "currency_code must be one of: GHS, USD" };
    }
  }

  const updated = await repo.updatePolicy(companyId, {
    default_daily_hours: data.default_daily_hours,
    overtime_multiplier: data.overtime_multiplier,
    lateness_tracking_enabled: data.lateness_tracking_enabled,
    late_pay_deduction_enabled: data.late_pay_deduction_enabled,
    payroll_enabled: data.payroll_enabled,
    business_timezone: businessTimezonePayload,
    attendance_day_classification_enabled: data.attendance_day_classification_enabled,
    minimum_minutes_for_counted_day: minM,
    full_day_minutes_threshold: fullM,
    currency_code: currencyPayload,
    working_weekdays: workingWeekdaysPayload,
  });

  if (!updated) {
    return { data: null, error: "Failed to update policy" };
  }
  return { data: updated };
}
