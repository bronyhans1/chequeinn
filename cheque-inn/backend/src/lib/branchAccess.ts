import type { RequestContext } from "../middleware/context.middleware";

/**
 * Company admin sees all branches. Manager / HR (without admin) see only their branch.
 * Employee self-service uses userId checks on routes, not this helper.
 */
export function isCompanyAdminRole(roles: string[]): boolean {
  return roles.includes("admin");
}

/** Manager or HR who should be branch-scoped (admin overrides). */
export function isBranchScopedManagerRole(roles: string[]): boolean {
  if (roles.includes("admin")) return false;
  return roles.includes("manager") || roles.includes("HR");
}

/**
 * For company-wide list/analytics endpoints:
 * - `undefined` → no user_id filter (company admin)
 * - `string[]` → restrict to these user ids (manager/HR: pass active users in branch)
 *
 * Callers should load ids via `users.repository.findActiveUserIdsByBranch` when scoped.
 */
export type ScopedUserIds = string[] | undefined;

export function assertBranchContextForScopedRole(
  context: RequestContext
): { ok: true; branchId: string } | { ok: false; status: 403; message: string } {
  if (!context.companyId) {
    return { ok: false, status: 403, message: "Company context required" };
  }
  if (!isBranchScopedManagerRole(context.roles)) {
    return { ok: true, branchId: context.branchId ?? "" };
  }
  if (!context.branchId) {
    return {
      ok: false,
      status: 403,
      message: "Branch context required for this role",
    };
  }
  return { ok: true, branchId: context.branchId };
}
