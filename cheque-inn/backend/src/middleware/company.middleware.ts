import { Response, NextFunction } from "express";
import { ContextRequest } from "./context.middleware";

/**
 * Ensures the request has a company-scoped context.
 * Platform users (PLATFORM_ADMIN) are expected to use platform routes only.
 */
export function requireCompanyContext(
  req: ContextRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.context) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.context.companyId) {
    return res.status(403).json({ error: "Company context required" });
  }

  next();
}

