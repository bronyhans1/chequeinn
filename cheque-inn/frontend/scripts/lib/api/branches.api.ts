import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/** Matches backend branch DTO (attendance fields on physical branch site). */
export interface BranchDto {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  created_at?: string;
  qr_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

export interface PatchBranchInput {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

export async function getBranches(): Promise<ApiResponse<BranchDto[]>> {
  return apiClient.get<BranchDto[]>("/api/branches");
}

export async function createBranch(name: string): Promise<ApiResponse<BranchDto>> {
  return apiClient.post<BranchDto>("/api/branches", { name });
}

export async function patchBranch(
  branchId: string,
  body: PatchBranchInput
): Promise<ApiResponse<BranchDto>> {
  return apiClient.patch<BranchDto>(`/api/branches/${branchId}`, body);
}

/** @deprecated Use patchBranch — kept for any legacy callers. */
export async function updateBranch(
  branchId: string,
  name: string
): Promise<ApiResponse<BranchDto>> {
  return patchBranch(branchId, { name });
}

export async function deleteBranch(branchId: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/api/branches/${branchId}`);
}
