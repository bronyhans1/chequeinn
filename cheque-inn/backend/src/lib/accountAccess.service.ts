import { supabaseAdmin } from "../config/supabase";
import { normalizeRoles } from "../config/roles";
import { roleNamesFromUserRolesJoin } from "./supabaseRoleJoin";
import {
  AccessBlock,
  AccountStatus,
  evaluateAccessForRequester,
  normalizeAccountStatus,
} from "./accountStatus";

export interface AccountAccessResult {
  block: AccessBlock | null;
  /** True when the user has PLATFORM_ADMIN in user_roles (informational only). */
  isPlatformAdmin: boolean;
}

const ROLES_FAILED_BLOCK: AccessBlock = {
  code: "ROLES_LOOKUP_FAILED",
  message: "Unable to verify your permissions. Try again shortly or contact support.",
};

const NO_ROLES_BLOCK: AccessBlock = {
  code: "NO_ROLES_ASSIGNED",
  message: "Your account has no roles assigned. Contact your administrator.",
};

const USER_RECORD_FAILED_BLOCK: AccessBlock = {
  code: "USER_RECORD_UNAVAILABLE",
  message: "Unable to verify your account. Try again shortly or contact support.",
};

/**
 * Loads roles + optional app user row + company status.
 * Fail closed when role data is missing or the DB cannot answer reliably.
 */
export async function resolveAccountAccess(userId: string): Promise<AccountAccessResult> {
  const { data: rolesData, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);

  if (rolesErr) {
    return { block: ROLES_FAILED_BLOCK, isPlatformAdmin: false };
  }

  if (!rolesData || rolesData.length === 0) {
    return { block: NO_ROLES_BLOCK, isPlatformAdmin: false };
  }

  const rawRoles = roleNamesFromUserRolesJoin(rolesData);
  const roles = normalizeRoles(rawRoles);
  const isPlatformAdmin = roles.includes("PLATFORM_ADMIN");

  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("company_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    return { block: USER_RECORD_FAILED_BLOCK, isPlatformAdmin };
  }

  if (!user) {
    if (isPlatformAdmin) {
      return { block: null, isPlatformAdmin: true };
    }
    return {
      block: {
        code: "USER_RECORD_UNAVAILABLE",
        message:
          "Your account is not fully provisioned in the company directory. Contact your administrator.",
      },
      isPlatformAdmin: false,
    };
  }

  const u = user as { company_id: string | null; status?: string | null };
  const userStatus = normalizeAccountStatus(u.status);

  let companyStatus: AccountStatus | null = null;
  if (u.company_id) {
    const { data: comp } = await supabaseAdmin
      .from("companies")
      .select("status")
      .eq("id", u.company_id)
      .maybeSingle();
    companyStatus = normalizeAccountStatus((comp as { status?: string } | null)?.status);
  }

  const ev = evaluateAccessForRequester({
    roles,
    userRow: { status: userStatus, company_id: u.company_id ?? null },
    companyStatus,
  });

  if (!ev.allowed) {
    /**
     * Company HTTP routes use `contextMiddleware`, which re-evaluates access **without**
     * this escape hatch — suspended platform admins cannot call `/api/users`, `/api/sessions`, etc.
     * Here we only allow them to pass **auth-level** gates (`/api/auth/me`, `/api/platform/*`).
     */
    if (isPlatformAdmin) {
      return { block: null, isPlatformAdmin: true };
    }
    return { block: ev.block, isPlatformAdmin: false };
  }

  return { block: null, isPlatformAdmin };
}
