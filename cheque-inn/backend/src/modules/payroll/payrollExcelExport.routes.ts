import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { requirePayrollEnabled } from "../../middleware/requirePayrollEnabled.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as payrollExcelExportController from "./payrollExcelExport.controller";

const router = Router();

const adminHrGuard = [
  ...companyApiStack,
  requirePayrollEnabled,
  requireRole(["admin", "HR"]),
];

router.get(
  "/export/excel",
  ...adminHrGuard,
  createRateLimit({ keyPrefix: "payroll:export-excel", windowMs: 60_000, max: 8 }),
  payrollExcelExportController.exportMonthlyPayrollExcel
);

export default router;
