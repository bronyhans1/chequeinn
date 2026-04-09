import { supabaseAdmin } from "../../config/supabase";

export interface CompanyPolicyRecord {
  id: string;
  company_id: string;
  default_daily_hours: number;
  overtime_multiplier: number;
  /** When false, clock-in stores late_minutes as 0 (no lateness analytics). */
  lateness_tracking_enabled: boolean;
  /** When true and payroll is on, reduce gross by time value of late_minutes. */
  late_pay_deduction_enabled: boolean;
  /** When false, payroll/earnings/wage APIs are disabled; attendance continues. */
  payroll_enabled: boolean;
  /** IANA timezone for company calendar "today" in earnings (default UTC). */
  business_timezone: string;
  attendance_day_classification_enabled: boolean;
  /** Completed minutes below this do not count for monthly salary. */
  minimum_minutes_for_counted_day: number;
  /** Completed minutes >= this count as full day (1.0); from min up to (not including) this = half day when classification on. */
  full_day_minutes_threshold: number;
  /** Payroll display currency (company-wide). */
  currency_code: string;
  /** JSON array of weekday numbers 1=Mon … 7=Sun */
  working_weekdays: unknown;
  created_at: string;
  updated_at: string;
}

export interface CreatePolicyData {
  company_id: string;
  default_daily_hours?: number;
  overtime_multiplier?: number;
  lateness_tracking_enabled?: boolean;
  late_pay_deduction_enabled?: boolean;
  payroll_enabled?: boolean;
  business_timezone?: string;
  attendance_day_classification_enabled?: boolean;
  minimum_minutes_for_counted_day?: number;
  full_day_minutes_threshold?: number;
  currency_code?: string;
  working_weekdays?: unknown;
}

export interface UpdatePolicyData {
  default_daily_hours?: number;
  overtime_multiplier?: number;
  lateness_tracking_enabled?: boolean;
  late_pay_deduction_enabled?: boolean;
  payroll_enabled?: boolean;
  business_timezone?: string;
  attendance_day_classification_enabled?: boolean;
  minimum_minutes_for_counted_day?: number;
  full_day_minutes_threshold?: number;
  currency_code?: string;
  working_weekdays?: unknown;
}

export async function getPolicyByCompany(
  companyId: string
): Promise<CompanyPolicyRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("company_policies")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as CompanyPolicyRecord | null;
}

export async function createPolicy(
  companyId: string,
  data: Partial<CreatePolicyData>
): Promise<CompanyPolicyRecord> {
  const payload = {
    company_id: companyId,
    default_daily_hours: data.default_daily_hours ?? 8,
    overtime_multiplier: data.overtime_multiplier ?? 1.5,
    lateness_tracking_enabled: data.lateness_tracking_enabled ?? true,
    late_pay_deduction_enabled: data.late_pay_deduction_enabled ?? false,
    payroll_enabled: data.payroll_enabled ?? true,
    business_timezone: data.business_timezone ?? "UTC",
    attendance_day_classification_enabled: data.attendance_day_classification_enabled ?? false,
    minimum_minutes_for_counted_day: data.minimum_minutes_for_counted_day ?? 60,
    full_day_minutes_threshold: data.full_day_minutes_threshold ?? 480,
    currency_code: data.currency_code,
    working_weekdays: data.working_weekdays ?? [1, 2, 3, 4, 5],
  };

  const { data: row, error } = await supabaseAdmin
    .from("company_policies")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return row as CompanyPolicyRecord;
}

export async function updatePolicy(
  companyId: string,
  data: UpdatePolicyData
): Promise<CompanyPolicyRecord | null> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.default_daily_hours !== undefined) {
    updates.default_daily_hours = data.default_daily_hours;
  }
  if (data.overtime_multiplier !== undefined) {
    updates.overtime_multiplier = data.overtime_multiplier;
  }
  if (data.lateness_tracking_enabled !== undefined) {
    updates.lateness_tracking_enabled = data.lateness_tracking_enabled;
  }
  if (data.late_pay_deduction_enabled !== undefined) {
    updates.late_pay_deduction_enabled = data.late_pay_deduction_enabled;
  }
  if (data.payroll_enabled !== undefined) {
    updates.payroll_enabled = data.payroll_enabled;
  }
  if (data.currency_code !== undefined) {
    updates.currency_code = data.currency_code;
  }
  if (data.working_weekdays !== undefined) {
    updates.working_weekdays = data.working_weekdays;
  }
  if (data.business_timezone !== undefined) {
    updates.business_timezone = data.business_timezone;
  }
  if (data.attendance_day_classification_enabled !== undefined) {
    updates.attendance_day_classification_enabled = data.attendance_day_classification_enabled;
  }
  if (data.minimum_minutes_for_counted_day !== undefined) {
    updates.minimum_minutes_for_counted_day = data.minimum_minutes_for_counted_day;
  }
  if (data.full_day_minutes_threshold !== undefined) {
    updates.full_day_minutes_threshold = data.full_day_minutes_threshold;
  }

  const { data: row, error } = await supabaseAdmin
    .from("company_policies")
    .update(updates)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return row as CompanyPolicyRecord;
}
