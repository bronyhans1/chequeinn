import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { requirePayrollEnabled } from "../../middleware/requirePayrollEnabled.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as payrollExportController from "./payrollExport.controller";

const router = Router();

const adminHrGuard = [
  ...companyApiStack,
  requirePayrollEnabled,
  requireRole(["admin", "HR"]),
];

router.get(
  "/export",
  ...adminHrGuard,
  createRateLimit({ keyPrefix: "payroll:export", windowMs: 60_000, max: 8 }),
  payrollExportController.exportMonthlyPayroll
);

export default router;
