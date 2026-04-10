import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export interface ProvisionCompanyInput {
  company_name: string;
  company_code?: string | null;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  temporary_password: string;
  /** NULL => unlimited */
  branch_limit?: number | null;
}

export interface ProvisionCompanyData {
  company_id: string;
  company_name: string;
  company_code: string;
  admin_user_id: string;
  admin_email: string;
  temporary_password_set: boolean;
}

export interface PlatformCompanyListItem {
  company_id: string;
  company_name: string;
  company_code: string;
  created_at?: string;
  admin_emails: string[];
  /** NULL => unlimited */
  branch_limit: number | null;
  branches_count: number;
  status: "active" | "inactive" | "suspended";
}

export interface PlatformDashboardData {
  totals: {
    companies: number;
    companies_active: number;
    companies_inactive: number;
    branches: number;
    departments: number;
    users_total: number;
    users_active: number;
    users_inactive: number;
  };
  recent_activity: Array<{
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    company_id: string;
    company_name: string | null;
    metadata?: unknown;
  }>;
}

export interface PlatformSupportSettings {
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp_url: string | null;
  updated_at?: string;
}

/** POST /api/platform/companies — PLATFORM_ADMIN only. */
export async function provisionCompany(
  input: ProvisionCompanyInput
): Promise<ApiResponse<ProvisionCompanyData>> {
  return apiClient.post<ProvisionCompanyData>("/api/platform/companies", input);
}

/** GET /api/platform/companies — PLATFORM_ADMIN only. */
export async function getCompanies(): Promise<ApiResponse<PlatformCompanyListItem[]>> {
  return apiClient.get<PlatformCompanyListItem[]>("/api/platform/companies");
}

export async function patchCompany(
  companyId: string,
  body: { branch_limit?: number | null; status?: "active" | "inactive" | "suspended" }
): Promise<ApiResponse<null>> {
  return apiClient.patch<null>(`/api/platform/companies/${companyId}`, body);
}

export async function updateCompanyBranchLimit(
  companyId: string,
  branchLimit: number | null
): Promise<ApiResponse<null>> {
  return patchCompany(companyId, { branch_limit: branchLimit });
}

export async function getPlatformDashboard(): Promise<ApiResponse<PlatformDashboardData>> {
  return apiClient.get<PlatformDashboardData>("/api/platform/dashboard");
}

/** GET /api/platform/support-settings — authenticated users. */
export async function getSupportSettings(): Promise<ApiResponse<PlatformSupportSettings>> {
  return apiClient.get<PlatformSupportSettings>("/api/platform/support-settings");
}

/** PATCH /api/platform/support-settings — PLATFORM_ADMIN only. */
export async function updateSupportSettings(input: {
  support_email?: string | null;
  support_phone?: string | null;
  support_whatsapp_url?: string | null;
}): Promise<ApiResponse<PlatformSupportSettings>> {
  return apiClient.patch<PlatformSupportSettings>("/api/platform/support-settings", input);
}

export async function deleteCompany(
  companyId: string,
  confirmCompanyName: string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/api/platform/companies/${companyId}`, {
    body: JSON.stringify({ confirm_company_name: confirmCompanyName }),
    headers: { "Content-Type": "application/json" },
  });
}

