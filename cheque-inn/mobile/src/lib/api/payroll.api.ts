import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";

/** GET /api/payroll/me — placeholder; backend exists. */
export interface PayrollMeItem {
  [key: string]: unknown;
}

export async function getMyPayroll(): Promise<ApiResponse<PayrollMeItem>> {
  return apiClient.get<PayrollMeItem>("/api/payroll/me");
}

export interface EarningsSummary {
  rate_type: "hourly" | "monthly" | "none";
  monthly_salary: number | null;
  expected_monthly_salary: number | null;
  daily_rate: number | null;
  payable_days_in_month: number;
  paid_days: number;
  unpaid_days: number;
  today_earned: number;
  today_base_before_late?: number;
  today_late_deduction?: number;
  month_earned_total: number;
  month_base_before_late?: number;
  month_late_deduction_total?: number;
  month_earned_salary_daily: number;
  month_earned_hourly: number;
  divisor_type: string | null;
  /** IANA timezone used for calendar “today” (company policy). */
  business_timezone?: string;
  calendar_today?: string;
  earnings_period_label?: string;
  attendance_thresholds?: {
    minimum_minutes_for_counted_day: number;
    full_day_minutes_threshold: number;
  };
  daily_history: Array<{
    date: string;
    gross: number;
    record_type: string;
    base_before_late?: number;
    late_deduction?: number;
  }>;
}

export async function getMyEarningsSummary(): Promise<ApiResponse<EarningsSummary>> {
  return apiClient.get<EarningsSummary>("/api/payroll/earnings/me");
}
