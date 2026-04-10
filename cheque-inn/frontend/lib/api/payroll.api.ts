import { apiClient, getAuthToken } from "./client";
import { ENV } from "@/lib/env";
import type { ApiResponse } from "@/lib/types/api";

/** Matches backend payroll_records / PayrollReportResult.records[]. */
export interface PayrollRecord {
  id: string;
  user_id: string;
  company_id?: string;
  session_id?: string;
  employee_name?: string | null;
  employee_email?: string | null;
  regular_minutes?: number;
  overtime_minutes?: number;
  hours_worked: number;
  hourly_rate?: number;
  gross_earnings: number;
  /** Pre–late gross when stored; omit on legacy rows. */
  gross_before_late_deduction?: number | null;
  late_deduction_amount?: number | null;
  payroll_date: string;
  status?: string;
  record_type?: string;
}

/** GET /api/payroll/me and GET /api/payroll/company response. */
export interface PayrollReportResult {
  records: PayrollRecord[];
  total_hours: number;
  total_overtime_minutes: number;
  total_gross_pay: number;
  total_base_before_late: number;
  total_late_deduction: number;
}

export async function getMyPayroll(): Promise<ApiResponse<PayrollReportResult>> {
  return apiClient.get<PayrollReportResult>("/api/payroll/me");
}

export async function getCompanyPayroll(): Promise<ApiResponse<PayrollReportResult>> {
  return apiClient.get<PayrollReportResult>("/api/payroll/company");
}

/** Live earnings / salary summary (GET /api/payroll/earnings/me). */
export interface EarningsSummary {
  rate_type: "hourly" | "monthly" | "none";
  monthly_salary: number | null;
  expected_monthly_salary: number | null;
  daily_rate: number | null;
  payable_days_in_month: number;
  paid_days: number;
  unpaid_days: number;
  today_earned: number;
  today_base_before_late: number;
  today_late_deduction: number;
  month_earned_total: number;
  month_base_before_late: number;
  month_late_deduction_total: number;
  month_earned_salary_daily: number;
  month_earned_hourly: number;
  divisor_type: string | null;
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
    base_before_late: number;
    late_deduction: number;
  }>;
}

export async function getMyEarningsSummary(): Promise<ApiResponse<EarningsSummary>> {
  return apiClient.get<EarningsSummary>("/api/payroll/earnings/me");
}

/**
 * Download payslip PDF for a payroll record. Fetches with auth and triggers browser download.
 */
export async function downloadPayslip(payrollId: string): Promise<{ ok: boolean; error?: string }> {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(`${ENV.NEXT_PUBLIC_API_BASE_URL}/api/payroll/payslip/${payrollId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? `Download failed (${res.status})` };
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename="?([^";]+)"?/);
    const filename = match?.[1] ?? `payslip-${payrollId.slice(0, 8)}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Download failed" };
  }
}

/**
 * Download payroll CSV for a month. Requires admin/HR.
 */
export async function downloadPayrollCsv(year: number, month: number): Promise<{ ok: boolean; error?: string }> {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(
      `${ENV.NEXT_PUBLIC_API_BASE_URL}/api/payroll/export?year=${year}&month=${month}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? `Export failed (${res.status})` };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export failed" };
  }
}

/**
 * Download payroll Excel for a month. Requires admin/HR.
 */
export async function downloadPayrollExcel(year: number, month: number): Promise<{ ok: boolean; error?: string }> {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(
      `${ENV.NEXT_PUBLIC_API_BASE_URL}/api/payroll/export/excel?year=${year}&month=${month}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? `Export failed (${res.status})` };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${year}-${String(month).padStart(2, "0")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export failed" };
  }
}
