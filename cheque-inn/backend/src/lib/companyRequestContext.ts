import type { ContextRequest, RequestContext } from "../middleware/context.middleware";

/** Context after `requireCompanyContext` middleware; `companyId` is always set. */
export type CompanyRequestContext = RequestContext & { companyId: string };

/**
 * Company API routes must use `companyApiStack` (includes `requireCompanyContext`).
 * Call at the start of handlers to satisfy TypeScript and fail fast if middleware is miswired.
 */
export function getRequiredCompanyContext(req: ContextRequest): CompanyRequestContext {
  const c = req.context;
  if (!c?.companyId) {
    throw new Error("Invariant: company-scoped handler without companyId (check middleware stack)");
  }
  return c as CompanyRequestContext;
}
