import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as auditController from "./audit.controller";

const router = Router();

const adminManagerGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];

router.get("/company", ...adminManagerGuard, auditController.getCompanyAuditLogs);
router.get(
  "/entity/:entityType/:entityId",
  ...adminManagerGuard,
  auditController.getAuditLogsByEntity
);

export default router;
