import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/** Matches backend GET /api/users list item (UserResponse). */
export interface UserListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id: string;
  company_name: string | null;
  branch_id: string;
  department_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone_number?: string | null;
  profile_photo_url?: string | null;
  status: "active" | "inactive" | "suspended";
  shift_id?: string | null;
  roles?: string[];
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
}

/** Company role for new employee (not `admin`). Matches backend creatable roles. */
export type CreatableCompanyRole = "employee" | "manager" | "HR";

export interface CreateUserInput {
  first_name: string;
  last_name: string;
  email: string;
  /** Supabase Auth password — share securely with the new user. */
  temporary_password: string;
  role: CreatableCompanyRole;
  /** Optional; defaults to company default branch (Phase 1). */
  branch_id?: string;
}

export async function getUsers(): Promise<ApiResponse<UserListItem[]>> {
  return apiClient.get<UserListItem[]>("/api/users");
}

export async function getUserById(id: string): Promise<ApiResponse<UserListItem | null>> {
  return apiClient.get<UserListItem | null>(`/api/users/${id}`);
}

export async function createUser(
  input: CreateUserInput
): Promise<ApiResponse<UserListItem>> {
  return apiClient.post<UserListItem>("/api/users", input);
}

/** PATCH /api/users/:userId/shift — HR only. Body: { shift_id: string | null }. */
export async function assignShift(
  userId: string,
  shiftId: string | null
): Promise<ApiResponse<UserListItem>> {
  return apiClient.patch<UserListItem>(`/api/users/${userId}/shift`, {
    shift_id: shiftId,
  });
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  /** Company admin only (backend enforces). */
  branch_id?: string;
  /** Admin or manager only; department must belong to the user's branch. Null clears. */
  department_id?: string | null;
  /** Company admin or HR only (backend enforces). */
  status?: "active" | "inactive" | "suspended";
}

/** PATCH /api/users/:id — profile fields; branch_id requires admin. */
export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<ApiResponse<UserListItem>> {
  return apiClient.patch<UserListItem>(`/api/users/${userId}`, input);
}

export type DeleteUserOutcome = "permanently_deleted" | "deactivated_due_to_records";

export interface DeleteUserResult {
  outcome: DeleteUserOutcome;
  /** Present when outcome is `deactivated_due_to_records`. */
  message?: string;
}

export async function deleteUser(userId: string): Promise<ApiResponse<DeleteUserResult>> {
  return apiClient.delete<DeleteUserResult>(`/api/users/${userId}`);
}
