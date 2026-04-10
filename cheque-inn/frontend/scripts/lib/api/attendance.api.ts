import { apiClient, getAuthToken } from "./client";
import { ENV } from "@/lib/env";
import type { ApiResponse } from "@/lib/types/api";

export interface TodayOverview {
  present: number;
  active: number;
  completed: number;
  total_minutes_today: number;
  late_today: number;
  overtime_today: number;
  absent_today: number;
}

export interface LatenessSummaryEmployee {
  user_id: string;
  name: string;
  late_count: number;
  total_late_minutes: number;
  average_late_minutes: number;
  repeated_late: boolean;
  latest_late_at: string | null;
}

export interface LatenessSummary {
  period: { start: string; end: string };
  summary: { totalLateIncidents: number; repeatedLateEmployees: number };
  employees: LatenessSummaryEmployee[];
}

export interface FlagsSummaryEmployee {
  user_id: string;
  name: string;
  late_count: number;
  total_late_minutes: number;
  average_late_minutes: number;
  early_leave_count: number;
  total_early_leave_minutes: number;
  half_day_count: number;
  repeated_late: boolean;
  repeated_early_leave: boolean;
  frequent_half_day: boolean;
  attention_needed: boolean;
  attendance_flag_level: string;
}

export interface FlagsSummary {
  period: { start: string; end: string };
  summary: { employeesFlagged: number; highRiskEmployees: number };
  employees: FlagsSummaryEmployee[];
}

export interface AbsenceSummaryEmployee {
  user_id: string;
  name: string;
  absence_count: number;
  absence_dates: string[];
  repeated_absence: boolean;
}

export interface AbsenceSummary {
  period: { start: string; end: string };
  summary: { totalAbsenceIncidents: number; employeesWithAbsences: number };
  employees: AbsenceSummaryEmployee[];
}

export interface ActiveEmployeesResponse {
  active_count: number;
  active_sessions: Array<{
    user_id: string;
    check_in: string | null;
    department_id?: string | null;
  }>;
}

export async function getTodayOverview(): Promise<ApiResponse<TodayOverview>> {
  return apiClient.get<TodayOverview>("/api/attendance/today");
}

/** GET /api/sessions/history — current user; optional start/end (YYYY-MM-DD), page, limit */
export interface SessionHistoryItem {
  id: string;
  user_id: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  duration_minutes: number | null;
  total_hours: number | null;
  branch_id: string | null;
  branch_name: string | null;
  department_id: string | null;
  department_name: string | null;
  employee_name?: string | null;
  employee_email?: string | null;
  manual_check_in?: boolean | null;
  manual_check_in_reason?: string | null;
  manual_check_out?: boolean | null;
  manual_check_out_reason?: string | null;
}

export interface WorkSessionDto {
  id: string;
  user_id: string;
  company_id: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  manual_check_in?: boolean | null;
  manual_check_out?: boolean | null;
}

export interface SessionHistoryResponse {
  rows: SessionHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

function sessionHistoryQuery(params: {
  page?: number;
  limit?: number;
  start?: string;
  end?: string;
  user_id?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.user_id) qs.set("user_id", params.user_id);
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function getMySessionHistory(params?: {
  page?: number;
  limit?: number;
  start?: string;
  end?: string;
}): Promise<ApiResponse<SessionHistoryResponse>> {
  return apiClient.get<SessionHistoryResponse>(
    `/api/sessions/history${sessionHistoryQuery(params ?? {})}`
  );
}

/** GET /api/sessions/history/company — admin/manager/HR; optional user_id filter */
export async function getCompanySessionHistory(params?: {
  page?: number;
  limit?: number;
  start?: string;
  end?: string;
  user_id?: string;
}): Promise<ApiResponse<SessionHistoryResponse>> {
  return apiClient.get<SessionHistoryResponse>(
    `/api/sessions/history/company${sessionHistoryQuery(params ?? {})}`
  );
}

export async function manualClockIn(body: {
  user_id: string;
  department_id?: string | null;
  reason: string;
  note?: string | null;
}): Promise<ApiResponse<WorkSessionDto>> {
  return apiClient.post<WorkSessionDto>("/api/sessions/manual-clock-in", body);
}

export async function manualClockOut(body: {
  user_id: string;
  reason: string;
  note?: string | null;
}): Promise<ApiResponse<WorkSessionDto>> {
  return apiClient.post<WorkSessionDto>("/api/sessions/manual-clock-out", body);
}

export async function getActiveEmployees(): Promise<ApiResponse<ActiveEmployeesResponse>> {
  return apiClient.get<ActiveEmployeesResponse>("/api/attendance/active");
}

export async function getLatenessSummary(
  start: string,
  end: string
): Promise<ApiResponse<LatenessSummary>> {
  return apiClient.get<LatenessSummary>(
    `/api/attendance/lateness-summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
}

export async function getFlagsSummary(
  start: string,
  end: string
): Promise<ApiResponse<FlagsSummary>> {
  return apiClient.get<FlagsSummary>(
    `/api/attendance/flags-summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
}

export async function getAbsenceSummary(
  start: string,
  end: string
): Promise<ApiResponse<AbsenceSummary>> {
  return apiClient.get<AbsenceSummary>(
    `/api/attendance/absence-summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
}

async function downloadExcel(
  path: string,
  fallbackFilename: string
): Promise<{ ok: boolean; error?: string }> {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(`${ENV.NEXT_PUBLIC_API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        error:
          (data as { error?: string }).error ?? `Download failed (${res.status})`,
      };
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename=\"?([^\";]+)\"?/);
    const filename = match?.[1] ?? fallbackFilename;
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

export async function downloadLatenessSummaryExcel(
  start: string,
  end: string
): Promise<{ ok: boolean; error?: string }> {
  return downloadExcel(
    `/api/attendance/lateness-summary/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    `attendance-lateness-summary-${start}-to-${end}.xlsx`
  );
}

export async function downloadFlagsSummaryExcel(
  start: string,
  end: string
): Promise<{ ok: boolean; error?: string }> {
  return downloadExcel(
    `/api/attendance/flags-summary/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    `attendance-flags-summary-${start}-to-${end}.xlsx`
  );
}

export async function downloadAbsenceSummaryExcel(
  start: string,
  end: string
): Promise<{ ok: boolean; error?: string }> {
  return downloadExcel(
    `/api/attendance/absence-summary/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    `attendance-absence-summary-${start}-to-${end}.xlsx`
  );
}
