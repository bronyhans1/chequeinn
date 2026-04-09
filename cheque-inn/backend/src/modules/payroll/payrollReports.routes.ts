import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { requirePayrollEnabled } from "../../middleware/requirePayrollEnabled.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as payrollReportsController from "./payrollReports.controller";
import * as earningsController from "./earnings.controller";

const router = Router();

const guard = [...companyApiStack, requirePayrollEnabled];
const adminHrGuard = [
  ...companyApiStack,
  requirePayrollEnabled,
  requireRole(["admin", "HR"]),
];
/** Payroll sync audit log: available even when payroll module is disabled (historical errors). */
const adminHrCompany = [...companyApiStack, requireRole(["admin", "HR"])];

router.get("/me", ...guard, payrollReportsController.getMe);
router.get("/company", ...adminHrGuard, payrollReportsController.getCompany);
router.get("/month", ...adminHrGuard, payrollReportsController.getMonth);

router.get("/earnings/me", ...guard, earningsController.getMyEarnings);
router.get("/earnings/user/:userId", ...adminHrGuard, earningsController.getUserEarnings);

router.get(
  "/sync-failures/recent",
  ...adminHrCompany,
  payrollReportsController.getRecentPayrollSyncFailures
);

export default router;
