import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export type WageRateType = "hourly" | "monthly";
export type SalaryDivisorType = "dynamic_working_days" | "fixed_days";

export interface WageRateRecord {
  id: string;
  user_id: string;
  company_id: string;
  hourly_rate: number | null;
  effective_from: string;
  created_at: string;
  rate_type: WageRateType;
  monthly_salary: number | null;
  salary_divisor_type: SalaryDivisorType;
  salary_divisor_value: number;
}

export interface CreateWageRateBody {
  user_id: string;
  rate_type: WageRateType;
  effective_from: string;
  hourly_rate?: number;
  monthly_salary?: number;
  salary_divisor_type?: SalaryDivisorType;
  salary_divisor_value?: number;
}

export interface UpdateWageRateBody {
  hourly_rate?: number | null;
  monthly_salary?: number | null;
  effective_from?: string;
  rate_type?: WageRateType;
  salary_divisor_type?: SalaryDivisorType;
  salary_divisor_value?: number;
}

export async function getUserWageRates(userId: string): Promise<ApiResponse<WageRateRecord[]>> {
  return apiClient.get<WageRateRecord[]>(`/api/wage-rates/user/${encodeURIComponent(userId)}`);
}

export async function createWageRate(body: CreateWageRateBody): Promise<ApiResponse<WageRateRecord>> {
  return apiClient.post<WageRateRecord>("/api/wage-rates", body);
}

export async function updateWageRate(
  id: string,
  body: UpdateWageRateBody
): Promise<ApiResponse<WageRateRecord>> {
  return apiClient.patch<WageRateRecord>(`/api/wage-rates/${encodeURIComponent(id)}`, body);
}

export async function deleteWageRate(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiClient.delete<{ deleted: boolean }>(`/api/wage-rates/${encodeURIComponent(id)}`);
}
