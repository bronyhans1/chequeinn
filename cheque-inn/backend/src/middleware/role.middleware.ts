import { Response, NextFunction } from "express";
import { ContextRequest } from "./context.middleware";

/**
 * Usage:
 * requireRole("PLATFORM_ADMIN")
 * requireRole(["admin", "manager", "PLATFORM_ADMIN"])
 * User roles are normalized to canonical form (see config/roles.ts) before checks.
 */
export const requireRole = (allowedRoles: string | string[]) => {
  return (
    req: ContextRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.context) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userRoles = req.context.roles;

      const rolesArray = Array.isArray(allowedRoles)
        ? allowedRoles
        : [allowedRoles];

      const hasPermission = rolesArray.some(role =>
        userRoles.includes(role)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: "Forbidden: Insufficient permissions",
        });
      }

      next();
    } catch (err) {
      console.error("roleMiddleware error", err);
      return res.status(500).json({
        error: "Role authorization failed",
      });
    }
  };
};