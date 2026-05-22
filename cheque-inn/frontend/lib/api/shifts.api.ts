import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/** Matches backend ShiftRecord. */
export interface Shift {
  id: string;
  company_id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number | null;
  spans_midnight?: boolean;
  is_active?: boolean;
  created_at: string;
}

export interface CreateShiftInput {
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number;
}

export interface UpdateShiftInput {
  name?: string;
  start_time?: string;
  end_time?: string;
  grace_minutes?: number;
  is_active?: boolean;
}

export interface DeleteShiftResult {
  success: boolean;
  deactivated?: boolean;
  deleted?: boolean;
}

/** GET /api/shifts — any authenticated. */
export async function getShifts(): Promise<ApiResponse<Shift[]>> {
  return apiClient.get<Shift[]>("/api/shifts");
}

/** POST /api/shifts — any authenticated. */
export async function createShift(
  input: CreateShiftInput
): Promise<ApiResponse<Shift>> {
  return apiClient.post<Shift>("/api/shifts", input);
}

/** PATCH /api/shifts/:id — admin/manager only. */
export async function updateShift(
  id: string,
  input: UpdateShiftInput
): Promise<ApiResponse<Shift>> {
  return apiClient.patch<Shift>(`/api/shifts/${id}`, input);
}

/** DELETE /api/shifts/:shiftId — admin/manager only; may deactivate if sessions exist. */
export async function deleteShift(
  shiftId: string
): Promise<ApiResponse<DeleteShiftResult | null>> {
  return apiClient.delete<DeleteShiftResult | null>(`/api/shifts/${shiftId}`);
}
