import type { RequestContext } from "../middleware/context.middleware";
import * as usersRepo from "../modules/users/users.repository";
import { isBranchScopedManagerRole, isCompanyAdminRole } from "./branchAccess";

type ScopeError = { status: number; message: string };

/**
 * Dashboard-style aggregates (/attendance/today, /month, /active):
 * - admin → full company (`undefined`)
 * - manager / HR → users in their branch
 * - everyone else (e.g. employee) → only their own `userId`
 */
export async function resolveAggregationUserIds(
  context: RequestContext,
  companyId: string
): Promise<
  | { scopedUserIds: string[] | undefined; error?: undefined }
  | { scopedUserIds?: undefined; error: ScopeError }
> {
  if (isCompanyAdminRole(context.roles)) {
    return { scopedUserIds: undefined };
  }
  if (isBranchScopedManagerRole(context.roles)) {
    if (!context.branchId) {
      return {
        error: { status: 403, message: "Branch context required for this role" },
      };
    }
    const ids = await usersRepo.findActiveUserIdsByBranch(companyId, context.branchId);
    return { scopedUserIds: ids };
  }
  return { scopedUserIds: [context.userId] };
}

/**
 * Manager-only lists (leave company list, session history for company, etc.):
 * - admin → full company
 * - manager / HR → branch user ids
 * - others → should not call; returns 403-shaped error if not admin/manager/HR
 */
export async function resolveManagerListUserIds(
  context: RequestContext,
  companyId: string
): Promise<
  | { scopedUserIds: string[] | undefined; error?: undefined }
  | { scopedUserIds?: undefined; error: ScopeError }
> {
  if (isCompanyAdminRole(context.roles)) {
    return { scopedUserIds: undefined };
  }
  if (isBranchScopedManagerRole(context.roles)) {
    if (!context.branchId) {
      return {
        error: { status: 403, message: "Branch context required for this role" },
      };
    }
    const ids = await usersRepo.findActiveUserIdsByBranch(companyId, context.branchId);
    return { scopedUserIds: ids };
  }
  return {
    error: { status: 403, message: "Insufficient permissions for company-wide data" },
  };
}

/**
 * Leave company list + approve/reject: branch scope is **active** employees plus anyone in the branch
 * with **pending** leave (covers inactive/suspended employees until their requests are resolved).
 */
export async function resolveManagerListUserIdsForLeave(
  context: RequestContext,
  companyId: string
): Promise<
  | { scopedUserIds: string[] | undefined; error?: undefined }
  | { scopedUserIds?: undefined; error: ScopeError }
> {
  if (isCompanyAdminRole(context.roles)) {
    return { scopedUserIds: undefined };
  }
  if (isBranchScopedManagerRole(context.roles)) {
    if (!context.branchId) {
      return {
        error: { status: 403, message: "Branch context required for this role" },
      };
    }
    const active = await usersRepo.findActiveUserIdsByBranch(companyId, context.branchId);
    const pendingLeave = await usersRepo.findUserIdsWithPendingLeaveInBranch(
      companyId,
      context.branchId
    );
    const merged = [...new Set([...active, ...pendingLeave])];
    return { scopedUserIds: merged };
  }
  return {
    error: { status: 403, message: "Insufficient permissions for company-wide data" },
  };
}

/** Branch id for filtering user directory (`users` queries), or `undefined` for full company. */
export function listBranchIdFromContext(context: RequestContext): string | undefined {
  if (isCompanyAdminRole(context.roles)) return undefined;
  if (isBranchScopedManagerRole(context.roles)) {
    return context.branchId ?? undefined;
  }
  return undefined;
}
