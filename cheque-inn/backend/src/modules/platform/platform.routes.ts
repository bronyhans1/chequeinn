import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { enforceAccountNotBlocked } from "../../middleware/accountAccess.middleware";
import { contextMiddleware } from "../../middleware/context.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as platformController from "./platform.controller";

const router = Router();

const platformAdminGuard = [
  authMiddleware,
  enforceAccountNotBlocked,
  contextMiddleware,
  requireRole(["PLATFORM_ADMIN"]),
];

router.get(
  "/support-settings",
  authMiddleware,
  enforceAccountNotBlocked,
  platformController.getSupportSettings
);

router.post(
  "/companies",
  ...platformAdminGuard,
  createRateLimit({ keyPrefix: "platform:provision-company", windowMs: 60_000, max: 3 }),
  platformController.provisionCompany
);

router.get(
  "/dashboard",
  ...platformAdminGuard,
  platformController.getDashboard
);

router.get(
  "/companies",
  ...platformAdminGuard,
  platformController.listCompanies
);

router.patch(
  "/companies/:companyId",
  ...platformAdminGuard,
  platformController.patchCompany
);

router.delete(
  "/companies/:companyId",
  ...platformAdminGuard,
  createRateLimit({ keyPrefix: "platform:delete-company", windowMs: 60_000, max: 3 }),
  platformController.deleteCompany
);

router.delete(
  "/users/:userId",
  ...platformAdminGuard,
  createRateLimit({ keyPrefix: "platform:delete-user", windowMs: 60_000, max: 5 }),
  platformController.deleteUser
);

router.patch(
  "/support-settings",
  ...platformAdminGuard,
  platformController.patchSupportSettings
);

export default router;
