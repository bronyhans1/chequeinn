import { apiClient, ApiClientError } from "./client";
import type { ApiResponse } from "@/types/api";
import type { AuthUser } from "@/types/auth";
import { normalizeRolesForApp } from "@/lib/auth/roles";
import { normalizeZoneForIntl } from "@/lib/formatDateTime";

export interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: {
    id: string;
    name: string;
    branch_name?: string | null;
    payroll_enabled?: boolean;
    business_timezone?: string | null;
    status?: "active" | "inactive" | "suspended";
  };
  branch?: { id: string; name: string } | null;
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

/** GET /api/auth/me — backend returns unwrapped MeResponse. */
export async function getMe(): Promise<ApiResponse<AuthUser>> {
  try {
    const data = (await apiClient.get("/api/auth/me")) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      (data as ApiResponse<AuthUser>).success === false
    ) {
      return data as ApiResponse<AuthUser>;
    }
    const me = data as MeResponse;
    if (!me?.id) {
      return { success: false, error: "Unauthorized" };
    }
    const branchFromRow =
      me.branch && typeof me.branch.id === "string" && me.branch.id.trim()
        ? {
            id: me.branch.id.trim(),
            name:
              typeof me.branch.name === "string" && me.branch.name.trim()
                ? me.branch.name.trim()
                : "",
          }
        : null;

    const legacyBranchRaw = me.company?.branch_name;
    const legacyBranchName =
      typeof legacyBranchRaw === "string" && legacyBranchRaw.trim()
        ? legacyBranchRaw.trim()
        : null;

    const branchName = branchFromRow?.name || legacyBranchName || null;

    const user: AuthUser = {
      userId: me.id,
      email: me.email,
      companyId: me.company?.id ?? "",
      roles: normalizeRolesForApp(me.roles),
      firstName: (me.first_name ?? "").trim(),
      lastName: (me.last_name ?? "").trim(),
      companyName: (me.company?.name ?? "").trim(),
      payrollEnabled: me.company?.payroll_enabled !== false,
      accountStatus: me.status ?? "active",
      companyAccountStatus: me.company?.status ?? "active",
      businessTimeZone: normalizeZoneForIntl(
        typeof me.company?.business_timezone === "string" ? me.company.business_timezone : "UTC"
      ),
      branchId: branchFromRow?.id ?? null,
      branchName,
      dateOfBirth: me.date_of_birth ?? null,
      gender: me.gender ?? null,
      phoneNumber: me.phone_number ?? null,
      profilePhotoUrl: me.profile_photo_url ?? null,
      mustChangePassword: !!me.must_change_password,
      themePreference: me.theme_preference ?? "system",
      department: me.department ?? null,
      profileCompletion: {
        requiredComplete: !!me.profile_completion?.required_complete,
        missingRequiredFields: me.profile_completion?.missing_required_fields ?? [],
        recommendedMissingFields: me.profile_completion?.recommended_missing_fields ?? [],
      },
    };
    return { success: true, data: user };
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 403) {
      const body = e.body as { code?: string; error?: string } | undefined;
      const codes = new Set([
        "USER_INACTIVE",
        "USER_SUSPENDED",
        "COMPANY_INACTIVE",
        "COMPANY_SUSPENDED",
      ]);
      if (body?.code && codes.has(body.code)) {
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

export async function updateMyProfile(input: UpdateProfileInput): Promise<ApiResponse<AuthUser>> {
  try {
    const data = (await apiClient.patch("/api/auth/profile", input)) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      (data as ApiResponse<AuthUser>).success === false
    ) {
      return data as ApiResponse<AuthUser>;
    }
    const me = data as MeResponse;
    const mapped = await getMeFromResponse(me);
    return mapped;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update profile" };
  }
}

export async function markPasswordChanged(): Promise<ApiResponse<{ success: true }>> {
  try {
    return await apiClient.post<{ success: true }>("/api/auth/password-changed");
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update password status" };
  }
}

async function getMeFromResponse(me: MeResponse): Promise<ApiResponse<AuthUser>> {
  if (!me?.id) return { success: false, error: "Unauthorized" };
  const branchFromRow =
    me.branch && typeof me.branch.id === "string" && me.branch.id.trim()
      ? {
          id: me.branch.id.trim(),
          name:
            typeof me.branch.name === "string" && me.branch.name.trim()
              ? me.branch.name.trim()
              : "",
        }
      : null;
  const legacyBranchRaw = me.company?.branch_name;
  const legacyBranchName =
    typeof legacyBranchRaw === "string" && legacyBranchRaw.trim()
      ? legacyBranchRaw.trim()
      : null;
  const branchName = branchFromRow?.name || legacyBranchName || null;
  return {
    success: true,
    data: {
      userId: me.id,
      email: me.email,
      companyId: me.company?.id ?? "",
      roles: normalizeRolesForApp(me.roles),
      firstName: (me.first_name ?? "").trim(),
      lastName: (me.last_name ?? "").trim(),
      companyName: (me.company?.name ?? "").trim(),
      payrollEnabled: me.company?.payroll_enabled !== false,
      accountStatus: me.status ?? "active",
      companyAccountStatus: me.company?.status ?? "active",
      businessTimeZone: normalizeZoneForIntl(
        typeof me.company?.business_timezone === "string" ? me.company.business_timezone : "UTC"
      ),
      branchId: branchFromRow?.id ?? null,
      branchName,
      dateOfBirth: me.date_of_birth ?? null,
      gender: me.gender ?? null,
      phoneNumber: me.phone_number ?? null,
      profilePhotoUrl: me.profile_photo_url ?? null,
      mustChangePassword: !!me.must_change_password,
      themePreference: me.theme_preference ?? "system",
      department: me.department ?? null,
      profileCompletion: {
        requiredComplete: !!me.profile_completion?.required_complete,
        missingRequiredFields: me.profile_completion?.missing_required_fields ?? [],
        recommendedMissingFields: me.profile_completion?.recommended_missing_fields ?? [],
      },
    },
  };
}
