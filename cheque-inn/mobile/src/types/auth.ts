/**
 * Canonical role names aligned with backend.
 * Mobile is for company users only; PLATFORM_ADMIN is web-only.
 */
export type AppRole = "admin" | "manager" | "HR" | "employee" | "PLATFORM_ADMIN";

export interface AuthUser {
  userId: string;
  email: string;
  companyId: string;
  roles: AppRole[];
  firstName: string;
  lastName: string;
  companyName: string;
  /** Company payroll feature flag from GET /api/auth/me. */
  payrollEnabled: boolean;
  accountStatus: "active" | "inactive" | "suspended";
  companyAccountStatus: "active" | "inactive" | "suspended";
  /** IANA zone for company calendar — same as web earnings / policy. */
  businessTimeZone: string;
  /** Resolved branch id from `/api/auth/me` when available (Phase 1). */
  branchId: string | null;
  /** Display name: prefer `branch.name`, else legacy `company.branch_name`. */
  branchName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  mustChangePassword: boolean;
  themePreference: "light" | "dark" | "system";
  department: { id: string; name: string } | null;
  profileCompletion: {
    requiredComplete: boolean;
    missingRequiredFields: string[];
    recommendedMissingFields: string[];
  };
}
