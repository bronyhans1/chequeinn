import type { ContextRequest } from "../middleware/context.middleware";
import * as usersRepo from "../modules/users/users.repository";
import { isBranchScopedManagerRole, isCompanyAdminRole } from "./branchAccess";

/**
 * Branch-scoped managers may only manual-clock users in their branch (admin: any user in company).
 * Exported for regression tests; behavior must match session manual-clock routes.
 */
export async function assertManualClockTargetAllowed(
  req: ContextRequest,
  companyId: string,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const ctx = req.context!;
  if (isCompanyAdminRole(ctx.roles)) {
    return { ok: true };
  }
  if (!isBranchScopedManagerRole(ctx.roles)) {
    return {
      ok: false,
      status: 403,
      message: "You do not have permission to record manual attendance",
    };
  }
  if (!ctx.branchId) {
    return {
      ok: false,
      status: 403,
      message: "Branch context required for this role",
    };
  }
  const target = await usersRepo.findByIdAndCompanyId(targetUserId, companyId);
  if (!target || target.branch_id !== ctx.branchId) {
    return { ok: false, status: 404, message: "User not found" };
  }
  return { ok: true };
}
