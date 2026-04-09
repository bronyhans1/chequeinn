import { supabaseAdmin } from "../../config/supabase";

export type RateType = "hourly" | "monthly";
export type SalaryDivisorType = "dynamic_working_days" | "fixed_days";

export interface WageRateRecord {
  id: string;
  user_id: string;
  company_id: string;
  hourly_rate: number | null;
  effective_from: string;
  created_at: string;
  rate_type: RateType;
  monthly_salary: number | null;
  salary_divisor_type: SalaryDivisorType;
  salary_divisor_value: number;
}

export interface CreateWageRateData {
  user_id: string;
  company_id: string;
  effective_from: string;
  rate_type: RateType;
  hourly_rate?: number | null;
  monthly_salary?: number | null;
  salary_divisor_type?: SalaryDivisorType;
  salary_divisor_value?: number;
}

export interface UpdateWageRateData {
  hourly_rate?: number | null;
  effective_from?: string;
  rate_type?: RateType;
  monthly_salary?: number | null;
  salary_divisor_type?: SalaryDivisorType;
  salary_divisor_value?: number;
}

export interface EffectiveWageRow {
  id: string;
  user_id: string;
  company_id: string;
  rate_type: RateType;
  hourly_rate: number | null;
  monthly_salary: number | null;
  salary_divisor_type: SalaryDivisorType;
  salary_divisor_value: number;
  effective_from: string;
}

export async function getEffectiveWageRow(
  userId: string,
  companyId: string,
  asOfDateYmd: string
): Promise<EffectiveWageRow | null> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("id, user_id, company_id, rate_type, hourly_rate, monthly_salary, salary_divisor_type, salary_divisor_value, effective_from")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .lte("effective_from", asOfDateYmd)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    company_id: r.company_id as string,
    rate_type: (r.rate_type as RateType) ?? "hourly",
    hourly_rate: (r.hourly_rate as number | null) ?? null,
    monthly_salary: (r.monthly_salary as number | null) ?? null,
    salary_divisor_type: (r.salary_divisor_type as SalaryDivisorType) ?? "dynamic_working_days",
    salary_divisor_value: typeof r.salary_divisor_value === "number" ? r.salary_divisor_value : 30,
    effective_from: r.effective_from as string,
  };
}

export async function createWageRate(data: CreateWageRateData): Promise<WageRateRecord> {
  const payload: Record<string, unknown> = {
    user_id: data.user_id,
    company_id: data.company_id,
    effective_from: data.effective_from,
    rate_type: data.rate_type,
    salary_divisor_type: data.salary_divisor_type ?? "dynamic_working_days",
    salary_divisor_value: data.salary_divisor_value ?? 30,
  };
  if (data.rate_type === "hourly") {
    payload.hourly_rate = data.hourly_rate ?? null;
    payload.monthly_salary = null;
  } else {
    payload.hourly_rate = data.hourly_rate ?? null;
    payload.monthly_salary = data.monthly_salary ?? null;
  }

  const { data: row, error } = await supabaseAdmin.from("wage_rates").insert(payload).select("*").single();

  if (error) throw error;
  return row as WageRateRecord;
}

export async function getUserWageRates(userId: string, companyId: string): Promise<WageRateRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("effective_from", { ascending: false });

  if (error) throw error;
  return (data ?? []) as WageRateRecord[];
}

export async function getWageRateById(id: string, companyId: string): Promise<WageRateRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as WageRateRecord | null;
}

export async function updateWageRate(
  id: string,
  companyId: string,
  data: UpdateWageRateData
): Promise<WageRateRecord | null> {
  const updates: Record<string, unknown> = {};
  if (data.hourly_rate !== undefined) updates.hourly_rate = data.hourly_rate;
  if (data.effective_from !== undefined) updates.effective_from = data.effective_from;
  if (data.rate_type !== undefined) updates.rate_type = data.rate_type;
  if (data.monthly_salary !== undefined) updates.monthly_salary = data.monthly_salary;
  if (data.salary_divisor_type !== undefined) updates.salary_divisor_type = data.salary_divisor_type;
  if (data.salary_divisor_value !== undefined) updates.salary_divisor_value = data.salary_divisor_value;

  if (Object.keys(updates).length === 0) {
    return getWageRateById(id, companyId);
  }

  const { data: row, error } = await supabaseAdmin
    .from("wage_rates")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return row as WageRateRecord;
}

/** True if the company has any wage / salary assignment rows. */
export async function companyHasAnyWageRates(companyId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function deleteWageRate(id: string, companyId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return false;
    throw error;
  }
  return !!data;
}

/** Users who have (or had) a monthly wage row — used to fan out company-wide salary resyncs. */
export async function listUserIdsWithAnyMonthlyWageRow(companyId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("rate_type", "monthly");

  if (error) throw error;
  const ids = (data ?? []).map((r: { user_id: string }) => r.user_id);
  return [...new Set(ids)];
}

export async function findExistingByUserAndDate(
  userId: string,
  companyId: string,
  effectiveFrom: string
): Promise<WageRateRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("effective_from", effectiveFrom)
    .maybeSingle();

  if (error) throw error;
  return data as WageRateRecord | null;
}
