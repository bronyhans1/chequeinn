import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/** Matches backend department payload (record + branch summary). */
export interface Department {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  created_at: string;
  branch: { id: string; name: string } | null;
}

export interface CreateDepartmentInput {
  name: string;
  /** Optional; defaults to company default branch. */
  branch_id?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  /** Company admin only (backend enforces). */
  branch_id?: string;
}

/** GET /api/departments — admin/manager only. */
export async function getDepartments(): Promise<ApiResponse<Department[]>> {
  return apiClient.get<Department[]>("/api/departments");
}

/** GET /api/departments/:id — admin/manager only. */
export async function getDepartmentById(
  id: string
): Promise<ApiResponse<Department>> {
  return apiClient.get<Department>(`/api/departments/${id}`);
}

/** POST /api/departments — admin/manager only. */
export async function createDepartment(
  input: CreateDepartmentInput
): Promise<ApiResponse<Department>> {
  return apiClient.post<Department>("/api/departments", input);
}

/** PATCH /api/departments/:id — admin/manager only. */
export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput
): Promise<ApiResponse<Department>> {
  return apiClient.patch<Department>(`/api/departments/${id}`, input);
}

/** DELETE /api/departments/:id — admin/manager only. */
export async function deleteDepartment(
  id: string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/api/departments/${id}`);
}
