import { Response, NextFunction } from "express";
import { resolveAccountAccess } from "../lib/accountAccess.service";
import { AuthenticatedRequest } from "../types/auth";

function httpStatusForBlock(code: string | undefined): number {
  if (code === "ROLES_LOOKUP_FAILED" || code === "USER_RECORD_UNAVAILABLE") return 503;
  return 403;
}

/**
 * After JWT auth: block inactive/suspended users and companies, and fail closed on bad role state.
 */
export const enforceAccountNotBlocked = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { block } = await resolveAccountAccess(req.user.id);
    if (block) {
      return res
        .status(httpStatusForBlock(block.code))
        .json({ error: block.message, code: block.code });
    }
    next();
  } catch (err) {
    console.error("enforceAccountNotBlocked error", err);
    return res.status(500).json({ error: "Failed to verify account status" });
  }
};
