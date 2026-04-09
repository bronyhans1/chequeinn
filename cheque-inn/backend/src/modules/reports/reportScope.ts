import type { RequestContext } from "../../middleware/context.middleware";
import { resolveManagerListUserIds } from "../../lib/resolveScopedUserIds";
import { isCompanyAdminRole } from "../../lib/branchAccess";
import * as branchesRepo from "../branches/branches.repository";
import * as usersRepo from "../users/users.repository";

type ScopeError = { status: number; message: string };

/**
 * Reports: admin may narrow by `branch_id` query; manager/HR use resolveManagerListUserIds only.
 */
export async function resolveReportUserScope(
  context: RequestContext,
  companyId: string,
  queryBranchId?: string | null
): Promise<
  | { scopedUserIds: string[] | undefined; error?: undefined }
  | { scopedUserIds?: undefined; error: ScopeError }
> {
  const bid = typeof queryBranchId === "string" ? queryBranchId.trim() : "";
  if (isCompanyAdminRole(context.roles) && bid) {
    const b = await branchesRepo.findById(bid);
    if (!b || b.company_id !== companyId) {
      return {
        error: { status: 400, message: "Invalid branch_id for this company" },
      };
    }
    const ids = await usersRepo.findActiveUserIdsByBranch(companyId, bid);
    return { scopedUserIds: ids };
  }
  return resolveManagerListUserIds(context, companyId);
}

export function assertUserIdAllowedForScope(
  filterUserId: string | undefined,
  scopedUserIds: string[] | undefined
): { ok: true } | { ok: false; status: number; message: string } {
  if (!filterUserId?.trim()) return { ok: true };
  const uid = filterUserId.trim();
  if (scopedUserIds === undefined || scopedUserIds === null) return { ok: true };
  if (!scopedUserIds.includes(uid)) {
    return { ok: false, status: 404, message: "User not found" };
  }
  return { ok: true };
}
