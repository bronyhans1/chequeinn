import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export type DayUnits = 0 | 0.5 | 1;

export interface DayClassificationInfo {
  user_id: string;
  date: string;
  has_incomplete_session: boolean;
  worked_minutes_completed: number;
  classification_enabled: boolean;
  thresholds: { min: number; full: number };
  automatic_day_units: number;
  override_day_units: number | null;
  final_day_units: number;
  override_note: string | null;
}

export async function getDayClassification(input: {
  user_id: string;
  date: string;
}): Promise<ApiResponse<DayClassificationInfo>> {
  const qs = new URLSearchParams({ user_id: input.user_id, date: input.date }).toString();
  return apiClient.get<DayClassificationInfo>(`/api/attendance-day/classification?${qs}`);
}

export async function upsertDayOverride(input: {
  user_id: string;
  date: string;
  day_units: DayUnits;
  note?: string | null;
}): Promise<ApiResponse<unknown>> {
  return apiClient.post<unknown>("/api/attendance-day/override", input);
}

export async function deleteDayOverride(input: {
  user_id: string;
  date: string;
}): Promise<ApiResponse<{ deleted: boolean }>> {
  const qs = new URLSearchParams({ user_id: input.user_id, date: input.date }).toString();
  return apiClient.delete<{ deleted: boolean }>(`/api/attendance-day/override?${qs}`);
}

