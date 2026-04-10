import { apiClient, ApiClientError } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import type { AuthUser } from "@/lib/types/auth";
import { normalizeRolesForApp } from "@/lib/auth/roles";

/** Backend GET /api/auth/me returns this shape (unwrapped). */
export interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone_number?: string | null;
  profile_photo_url?: string | null;
  must_change_password?: boolean;
  theme_preference?: "light" | "dark" | "system";
  department?: { id: string; name: string } | null;
  profile_completion?: {
    required_complete: boolean;
    missing_required_fields: string[];
    recommended_missing_fields: string[];
  };
  company: {
    id: string;
    name: string;
    branch_name?: string | null;
    payroll_enabled?: boolean;
    status?: "active" | "inactive" | "suspended";
  };
  branch: { id: string; name: string } | null;
  roles: string[];
  status?: "active" | "inactive" | "suspended";
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
  phone_number?: string | null;
  profile_photo_url?: string | null;
  theme_preference?: "light" | "dark" | "system";
  department_id?: string | null;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface LoginData {
  token: string;
  user: AuthUser;
}

/**
 * Login: if your backend has POST /api/auth/login, use it here.
 * Otherwise integrate Supabase Auth and set the token from the session, then call getMe().
 */
export async function login(body: LoginBody): Promise<ApiResponse<LoginData>> {
  return apiClient.post<LoginData>("/api/auth/login", body);
}

export async function logout(): Promise<void> {
  // Optional: call backend logout if needed
}

export async function updateMyProfile(
  input: UpdateProfileInput
): Promise<ApiResponse<AuthUser>> {
  try {
    const data = (await apiClient.patch("/api/auth/profile", input)) as unknown;
    if (data && typeof data === "object" && "success" in data && (data as ApiResponse<AuthUser>).success === false) {
      return data as ApiResponse<AuthUser>;
    }
    return mapMeToAuthUser(data as MeResponse);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update profile" };
  }
}

export async function markPasswordChanged(): Promise<ApiResponse<{ success: true }>> {
  try {
    const data = await apiClient.post<{ success: true }>("/api/auth/password-changed");
    return data;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to mark password change" };
  }
}

function mapMeToAuthUser(me: MeResponse): ApiResponse<AuthUser> {
  if (!me?.id) {
    return { success: false, error: "Unauthorized" };
  }
  return {
    success: true,
    data: {
      userId: me.id,
      email: me.email,
      companyId: me.company?.id ?? "",
      roles: normalizeRolesForApp(me.roles),
      branch: me.branch ?? null,
      firstName: me.first_name ?? "",
      lastName: me.last_name ?? "",
      phoneNumber: me.phone_number ?? null,
      dateOfBirth: me.date_of_birth ?? null,
      gender: me.gender ?? null,
      profilePhotoUrl: me.profile_photo_url ?? null,
      mustChangePassword: !!me.must_change_password,
      themePreference: me.theme_preference ?? "system",
      department: me.department ?? null,
      companyName: me.company?.name ?? "",
      payrollEnabled: me.company?.payroll_enabled !== false,
      accountStatus: me.status ?? "active",
      companyAccountStatus: me.company?.status ?? "active",
      profileCompletion: {
        requiredComplete: !!me.profile_completion?.required_complete,
        missingRequiredFields: me.profile_completion?.missing_required_fields ?? [],
        recommendedMissingFields: me.profile_completion?.recommended_missing_fields ?? [],
      },
    },
  };
}

/** Fetches current user. Backend returns unwrapped MeResponse (no { success, data }); we map to AuthUser. */
const ACCESS_BLOCK_CODES = new Set([
  "USER_INACTIVE",
  "USER_SUSPENDED",
  "COMPANY_INACTIVE",
  "COMPANY_SUSPENDED",
]);

export async function getMe(): Promise<ApiResponse<AuthUser>> {
  try {
    const data = (await apiClient.get("/api/auth/me")) as unknown;
    if (data && typeof data === "object" && "success" in data && (data as ApiResponse<AuthUser>).success === false) {
      return data as ApiResponse<AuthUser>;
    }
    return mapMeToAuthUser(data as MeResponse);
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 403) {
      const body = e.body as { code?: string; error?: string } | undefined;
      if (body?.code && ACCESS_BLOCK_CODES.has(body.code)) {
        return {
          success: false,
          error: typeof body.error === "string" ? body.error : "Access denied",
          accessBlockCode: body.code,
        };
      }
    }
    return { success: false, error: "Unauthorized" };
  }
}
