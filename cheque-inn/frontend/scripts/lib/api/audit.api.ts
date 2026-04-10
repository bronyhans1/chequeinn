import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export interface AuditLog {
  id: string;
  company_id: string;
  actor_id: string;
  actor_name?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | Record<string, unknown> | null;
  created_at: string;
}

/**
 * Backend:
 * - GET /api/audit/company
 * - Authorization: Bearer <token>
 */
export async function getCompanyAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
  return apiClient.get<AuditLog[]>("/api/audit/company");
}

