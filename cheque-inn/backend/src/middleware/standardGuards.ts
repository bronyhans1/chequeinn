/**
 * Standard API stacks: auth, account status, request context.
 * Use these so blocked / incomplete accounts never hit business logic unintentionally.
 */
import { authMiddleware } from "./auth.middleware";
import { enforceAccountNotBlocked } from "./accountAccess.middleware";
import { contextMiddleware } from "./context.middleware";
import { requireCompanyContext } from "./company.middleware";

export const companyApiStack = [
  authMiddleware,
  enforceAccountNotBlocked,
  contextMiddleware,
  requireCompanyContext,
];

/** Platform admin routes: JWT + account status + roles; no company tenant context. */
export const platformAdminStack = [
  authMiddleware,
  enforceAccountNotBlocked,
  contextMiddleware,
];
