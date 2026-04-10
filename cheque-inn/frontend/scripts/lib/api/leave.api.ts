import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/** Matches backend leave_requests response. */
export interface LeaveRequest {
  id: string;
  user_id: string;
  company_id: string;
  employee_name?: string | null;
  employee_email?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  reason: string | null;
  /** API returns PENDING | APPROVED | REJECTED */
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface RequestLeaveInput {
  start_date: string;
  end_date: string;
  leave_type: string;
  reason?: string | null;
}

export async function getMyLeaveRequests(): Promise<ApiResponse<LeaveRequest[]>> {
  return apiClient.get<LeaveRequest[]>("/api/leave/my");
}

export async function getCompanyLeaveRequests(
  status?: "pending" | "approved" | "rejected" | "PENDING" | "APPROVED" | "REJECTED" | ""
): Promise<ApiResponse<LeaveRequest[]>> {
  const q =
    status && String(status).trim() !== ""
      ? `?status=${encodeURIComponent(String(status).toLowerCase())}`
      : "";
  return apiClient.get<LeaveRequest[]>(`/api/leave/company${q}`);
}

export async function requestLeave(
  input: RequestLeaveInput
): Promise<ApiResponse<LeaveRequest>> {
  return apiClient.post<LeaveRequest>("/api/leave", input);
}

export async function approveLeave(leaveId: string): Promise<ApiResponse<LeaveRequest>> {
  return apiClient.patch<LeaveRequest>(`/api/leave/${leaveId}/approve`, {});
}

export async function rejectLeave(leaveId: string): Promise<ApiResponse<LeaveRequest>> {
  return apiClient.patch<LeaveRequest>(`/api/leave/${leaveId}/reject`, {});
}

export async function reviewLeave(
  leaveId: string,
  action: "approve" | "reject"
): Promise<ApiResponse<LeaveRequest>> {
  return apiClient.patch<LeaveRequest>(`/api/leave/${leaveId}/review`, {
    action,
  });
}
