import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";

export interface LeaveRequestItem {
  id: string;
  user_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  reason: string | null;
  /** PENDING | APPROVED | REJECTED */
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  employee_name?: string | null;
  employee_email?: string | null;
}

export interface RequestLeaveInput {
  start_date: string;
  end_date: string;
  leave_type: string;
  reason?: string | null;
}

export async function getMyLeave(): Promise<ApiResponse<LeaveRequestItem[]>> {
  return apiClient.get<LeaveRequestItem[]>("/api/leave/my");
}

export async function requestLeave(
  input: RequestLeaveInput
): Promise<ApiResponse<LeaveRequestItem>> {
  return apiClient.post<LeaveRequestItem>("/api/leave", input);
}
