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

/** DELETE /api/shifts/:shiftId — admin/manager only. */
export async function deleteShift(shiftId: string): Promise<ApiResponse<Shift | null>> {
  return apiClient.delete<Shift | null>(`/api/shifts/${shiftId}`);
}
