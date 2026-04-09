export const ACCOUNT_STATUSES = ["active", "inactive", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const ALLOWED = new Set<string>(ACCOUNT_STATUSES);

export function isAllowedAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && ALLOWED.has(value);
}

/** Normalize DB or API input; unknown values default to active for safety. */
export function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  if (value && ALLOWED.has(value)) return value as AccountStatus;
  return "active";
}

export type AccessBlockCode =
  | "USER_INACTIVE"
  | "USER_SUSPENDED"
  | "COMPANY_INACTIVE"
  | "COMPANY_SUSPENDED"
  | "NO_ROLES_ASSIGNED"
  | "ROLES_LOOKUP_FAILED"
  | "USER_RECORD_UNAVAILABLE";

export interface AccessBlock {
  code: AccessBlockCode;
  message: string;
}

export function blockForUserStatus(status: AccountStatus): AccessBlock | null {
  if (status === "active") return null;
  if (status === "inactive") {
    return {
      code: "USER_INACTIVE",
      message:
        "Your account is inactive. Please contact your company administrator.",
    };
  }
  return {
    code: "USER_SUSPENDED",
    message:
      "Your account has been suspended. Please contact your company administrator.",
  };
}

export function blockForCompanyStatus(status: AccountStatus): AccessBlock | null {
  if (status === "active") return null;
  if (status === "inactive") {
    return {
      code: "COMPANY_INACTIVE",
      message:
        "Your company account is inactive. Please contact Cheque-Inn Systems support.",
    };
  }
  return {
    code: "COMPANY_SUSPENDED",
    message:
      "Your company account has been suspended. Please contact Cheque-Inn Systems support.",
  };
}

export type AccessEvaluation = { allowed: true } | { allowed: false; block: AccessBlock };

/**
 * Company-linked identities must be active with an active company.
 * PLATFORM_ADMIN has no special bypass here: mixed admin+employee accounts are governed
 * by the same user/company status when a `users` row exists (see context middleware).
 */
export function evaluateAccessForRequester(input: {
  roles: string[];
  userRow: { status: AccountStatus; company_id: string | null };
  companyStatus: AccountStatus | null;
}): AccessEvaluation {
  const userBlock = blockForUserStatus(input.userRow.status);
  if (userBlock) return { allowed: false, block: userBlock };
  if (!input.userRow.company_id) {
    return { allowed: true };
  }
  const cs = input.companyStatus ?? "active";
  const companyBlock = blockForCompanyStatus(cs);
  if (companyBlock) return { allowed: false, block: companyBlock };
  return { allowed: true };
}
