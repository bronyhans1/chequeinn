import { apiClient, getAuthToken } from "./client";
import { ENV } from "@/lib/env";
import type { ApiResponse } from "@/lib/types/api";

export interface AttendanceReportRow {
  session_id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  branch_name: string;
  department_name: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  duration_minutes: number | null;
  total_hours: number | null;
}

export interface AttendanceReportData {
  rows: AttendanceReportRow[];
  total: number;
  page: number;
  limit: number;
  period: { start: string; end: string };
}

export interface LeaveReportRow {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  branch_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string;
  reviewed_at: string | null;
}

export interface LeaveReportData {
  rows: LeaveReportRow[];
  total: number;
  page: number;
  limit: number;
  period: { start: string; end: string };
}

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getAttendanceReport(params: {
  start: string;
  end: string;
  page?: number;
  limit?: number;
  user_id?: string;
  branch_id?: string;
}): Promise<ApiResponse<AttendanceReportData>> {
  return apiClient.get<AttendanceReportData>(
    `/api/reports/attendance${buildQuery({
      start: params.start,
      end: params.end,
      page: params.page !== undefined ? String(params.page) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      user_id: params.user_id,
      branch_id: params.branch_id,
    })}`
  );
}

export async function getLeaveReport(params: {
  start: string;
  end: string;
  page?: number;
  limit?: number;
  user_id?: string;
  branch_id?: string;
  status?: string;
}): Promise<ApiResponse<LeaveReportData>> {
  return apiClient.get<LeaveReportData>(
    `/api/reports/leave${buildQuery({
      start: params.start,
      end: params.end,
      page: params.page !== undefined ? String(params.page) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      user_id: params.user_id,
      branch_id: params.branch_id,
      status: params.status,
    })}`
  );
}

async function downloadBlob(
  path: string,
  filenameFallback: string
): Promise<{ ok: boolean; error?: string }> {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const url = `${ENV.NEXT_PUBLIC_API_BASE_URL}${path}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: (data as { error?: string }).error ?? `Download failed (${res.status})`,
      };
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition");
    const match = cd?.match(/filename="?([^";]+)"?/);
    const filename = match?.[1] ?? filenameFallback;
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Download failed" };
  }
}

export async function downloadAttendanceReportCsv(params: {
  start: string;
  end: string;
  user_id?: string;
  branch_id?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return downloadBlob(
    `/api/reports/attendance/export${buildQuery({
      start: params.start,
      end: params.end,
      user_id: params.user_id,
      branch_id: params.branch_id,
    })}`,
    "attendance-report.csv"
  );
}

export async function downloadAttendanceReportExcel(params: {
  start: string;
  end: string;
  user_id?: string;
  branch_id?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return downloadBlob(
    `/api/reports/attendance/export.xlsx${buildQuery({
      start: params.start,
      end: params.end,
      user_id: params.user_id,
      branch_id: params.branch_id,
    })}`,
    "attendance-report.xlsx"
  );
}

export async function downloadLeaveReportCsv(params: {
  start: string;
  end: string;
  user_id?: string;
  branch_id?: string;
  status?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return downloadBlob(
    `/api/reports/leave/export${buildQuery({
      start: params.start,
      end: params.end,
      user_id: params.user_id,
      branch_id: params.branch_id,
      status: params.status,
    })}`,
    "leave-report.csv"
  );
}
