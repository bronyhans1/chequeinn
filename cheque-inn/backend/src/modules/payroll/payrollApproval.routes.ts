import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { requirePayrollEnabled } from "../../middleware/requirePayrollEnabled.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as payrollApprovalController from "./payrollApproval.controller";

const router = Router();

const adminManagerGuard = [
  ...companyApiStack,
  requirePayrollEnabled,
  requireRole(["admin", "manager"]),
];

router.patch(
  "/:id/approve",
  ...adminManagerGuard,
  createRateLimit({ keyPrefix: "payroll:approve", windowMs: 60_000, max: 20 }),
  payrollApprovalController.approvePayrollRecord
);

router.patch(
  "/:id/lock",
  ...adminManagerGuard,
  createRateLimit({ keyPrefix: "payroll:lock", windowMs: 60_000, max: 20 }),
  payrollApprovalController.lockPayrollRecord
);

export default router;
