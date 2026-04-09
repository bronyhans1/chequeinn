import * as repo from "./wageRates.repository";
import * as usersRepo from "../users/users.repository";

export type RateType = repo.RateType;
export type SalaryDivisorType = repo.SalaryDivisorType;

export interface CreateWageRateInput {
  user_id: string;
  rate_type: RateType;
  effective_from: string;
  hourly_rate?: number;
  monthly_salary?: number;
  salary_divisor_type?: SalaryDivisorType;
  salary_divisor_value?: number;
}

export interface UpdateWageRateInput {
  hourly_rate?: number | null;
  effective_from?: string;
  rate_type?: RateType;
  monthly_salary?: number | null;
  salary_divisor_type?: SalaryDivisorType;
  salary_divisor_value?: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseRateType(value: unknown): RateType | null {
  if (value === "hourly" || value === "monthly") return value;
  if (value === undefined || value === null) return "hourly";
  return null;
}

export async function createWageRate(
  companyId: string,
  input: CreateWageRateInput
): Promise<ServiceResult<repo.WageRateRecord>> {
  const userId = typeof input.user_id === "string" ? input.user_id.trim() : "";
  if (!userId) {
    return { data: null, error: "user_id is required" };
  }

  const user = await usersRepo.findByIdAndCompanyId(userId, companyId);
  if (!user) {
    return { data: null, error: "User not found" };
  }

  const rateType = parseRateType(input.rate_type);
  if (!rateType) {
    return { data: null, error: "rate_type must be hourly or monthly" };
  }

  const effectiveFrom = parseDate(input.effective_from);
  if (!effectiveFrom) {
    return { data: null, error: "effective_from must be a valid date" };
  }

  let hourly_rate: number | null = null;
  let monthly_salary: number | null = null;
  const divType: SalaryDivisorType =
    input.salary_divisor_type === "fixed_days" ? "fixed_days" : "dynamic_working_days";
  const divVal =
    typeof input.salary_divisor_value === "number" && Number.isFinite(input.salary_divisor_value)
      ? Math.max(1, Math.floor(input.salary_divisor_value))
      : 30;

  if (rateType === "hourly") {
    const hr = Number(input.hourly_rate);
    if (!Number.isFinite(hr) || hr <= 0) {
      return { data: null, error: "hourly_rate must be greater than 0 for hourly employees" };
    }
    hourly_rate = hr;
    monthly_salary = null;
  } else {
    const ms = Number(input.monthly_salary);
    if (!Number.isFinite(ms) || ms <= 0) {
      return { data: null, error: "monthly_salary must be greater than 0 for monthly employees" };
    }
    monthly_salary = Math.round(ms * 100) / 100;
    hourly_rate =
      input.hourly_rate !== undefined && input.hourly_rate !== null
        ? Number(input.hourly_rate) > 0
          ? Number(input.hourly_rate)
          : null
        : null;
  }

  const existing = await repo.findExistingByUserAndDate(userId, companyId, effectiveFrom);
  if (existing) {
    return {
      data: null,
      error: "A wage rate already exists for this user with the same effective date",
    };
  }

  const record = await repo.createWageRate({
    user_id: userId,
    company_id: companyId,
    effective_from: effectiveFrom,
    rate_type: rateType,
    hourly_rate,
    monthly_salary,
    salary_divisor_type: divType,
    salary_divisor_value: divVal,
  });
  return { data: record };
}

export async function getUserWageRates(
  userId: string,
  companyId: string
): Promise<ServiceResult<repo.WageRateRecord[]>> {
  const user = await usersRepo.findByIdAndCompanyId(userId, companyId);
  if (!user) {
    return { data: null, error: "User not found" };
  }

  const records = await repo.getUserWageRates(userId, companyId);
  return { data: records };
}

export async function updateWageRate(
  id: string,
  companyId: string,
  input: UpdateWageRateInput
): Promise<ServiceResult<repo.WageRateRecord>> {
  const existing = await repo.getWageRateById(id, companyId);
  if (!existing) {
    return { data: null, error: "Wage rate not found" };
  }

  const updates: repo.UpdateWageRateData = {};
  const effectiveRateType = (input.rate_type ?? existing.rate_type) as RateType;

  if (input.rate_type !== undefined) {
    const rt = parseRateType(input.rate_type);
    if (!rt) return { data: null, error: "rate_type must be hourly or monthly" };
    updates.rate_type = rt;
  }

  if (input.hourly_rate !== undefined) {
    const rate = input.hourly_rate === null ? null : Number(input.hourly_rate);
    if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) {
      return { data: null, error: "hourly_rate must be greater than 0 when set" };
    }
    updates.hourly_rate = rate;
  }

  if (input.monthly_salary !== undefined) {
    const ms = input.monthly_salary === null ? null : Number(input.monthly_salary);
    if (ms !== null && (!Number.isFinite(ms) || ms <= 0)) {
      return { data: null, error: "monthly_salary must be greater than 0 when set" };
    }
    updates.monthly_salary = ms;
  }

  if (input.salary_divisor_type !== undefined) {
    updates.salary_divisor_type =
      input.salary_divisor_type === "fixed_days" ? "fixed_days" : "dynamic_working_days";
  }

  if (input.salary_divisor_value !== undefined) {
    const v = Number(input.salary_divisor_value);
    if (!Number.isFinite(v) || v < 1) {
      return { data: null, error: "salary_divisor_value must be at least 1" };
    }
    updates.salary_divisor_value = Math.floor(v);
  }

  if (input.effective_from !== undefined) {
    const effectiveFrom = parseDate(input.effective_from);
    if (!effectiveFrom) {
      return { data: null, error: "effective_from must be a valid date" };
    }
    const duplicate = await repo.findExistingByUserAndDate(existing.user_id, companyId, effectiveFrom);
    if (duplicate && duplicate.id !== id) {
      return {
        data: null,
        error: "A wage rate already exists for this user with the same effective date",
      };
    }
    updates.effective_from = effectiveFrom;
  }

  if (effectiveRateType === "hourly") {
    const nextHourly =
      updates.hourly_rate !== undefined ? updates.hourly_rate : existing.hourly_rate;
    if (nextHourly === null || typeof nextHourly !== "number" || nextHourly <= 0) {
      return { data: null, error: "hourly employees require hourly_rate > 0" };
    }
  } else {
    const nextMonthly =
      updates.monthly_salary !== undefined ? updates.monthly_salary : existing.monthly_salary;
    if (nextMonthly === null || typeof nextMonthly !== "number" || nextMonthly <= 0) {
      return { data: null, error: "monthly employees require monthly_salary > 0" };
    }
  }

  if (Object.keys(updates).length === 0) {
    return { data: existing };
  }

  const updated = await repo.updateWageRate(id, companyId, updates);
  return { data: updated ?? existing };
}

export async function deleteWageRate(
  id: string,
  companyId: string
): Promise<ServiceResult<{ deleted: boolean; user_id: string; effective_from: string }>> {
  const existing = await repo.getWageRateById(id, companyId);
  if (!existing) {
    return { data: null, error: "Wage rate not found" };
  }

  const deleted = await repo.deleteWageRate(id, companyId);
  if (!deleted) {
    return { data: null, error: "Wage rate not found" };
  }
  return {
    data: {
      deleted: true,
      user_id: existing.user_id,
      effective_from: existing.effective_from,
    },
  };
}
