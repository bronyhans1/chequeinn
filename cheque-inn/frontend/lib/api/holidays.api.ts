import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export interface CompanyHoliday {
  id: string;
  company_id: string;
  holiday_date: string;
  name: string;
  is_paid: boolean;
  created_at: string;
}

export async function listHolidays(year: number, month: number): Promise<ApiResponse<CompanyHoliday[]>> {
  return apiClient.get<CompanyHoliday[]>(
    `/api/company-holidays?year=${year}&month=${month}`
  );
}

export async function createHoliday(body: {
  holiday_date: string;
  name: string;
  is_paid?: boolean;
}): Promise<ApiResponse<CompanyHoliday>> {
  return apiClient.post<CompanyHoliday>("/api/company-holidays", body);
}

export async function deleteHoliday(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/api/company-holidays/${encodeURIComponent(id)}`);
}

export async function updateHoliday(
  id: string,
  body: Partial<{ holiday_date: string; name: string; is_paid: boolean }>
): Promise<ApiResponse<CompanyHoliday>> {
  return apiClient.patch<CompanyHoliday>(`/api/company-holidays/${encodeURIComponent(id)}`, body);
}
