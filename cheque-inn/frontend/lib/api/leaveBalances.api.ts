import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export interface LeaveBalanceRecord {
  id: string;
  user_id: string;
  company_id: string;
  total_days: number;
  used_days: number;
  updated_at: string;
}

export async function getUserLeaveBalance(userId: string): Promise<ApiResponse<LeaveBalanceRecord | null>> {
  return apiClient.get<LeaveBalanceRecord | null>(`/api/leave-balances/user/${userId}`);
}

export async function createLeaveBalance(input: {
  user_id: string;
  total_days: number;
  used_days?: number;
}): Promise<ApiResponse<LeaveBalanceRecord>> {
  return apiClient.post<LeaveBalanceRecord>("/api/leave-balances", input);
}

export async function updateLeaveBalance(
  id: string,
  input: { total_days?: number; used_days?: number }
): Promise<ApiResponse<LeaveBalanceRecord>> {
  return apiClient.patch<LeaveBalanceRecord>(`/api/leave-balances/${id}`, input);
}

