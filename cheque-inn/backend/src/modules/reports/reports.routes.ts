import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as reportsController from "./reports.controller";

const router = Router();

const managerHrGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];
const exportLimiter = createRateLimit({
  keyPrefix: "reports:export",
  windowMs: 60_000,
  max: 8,
});

router.get("/attendance", ...managerHrGuard, reportsController.getAttendanceReport);
router.get(
  "/attendance/export",
  ...managerHrGuard,
  exportLimiter,
  reportsController.exportAttendanceReportCsv
);
router.get(
  "/attendance/export.xlsx",
  ...managerHrGuard,
  exportLimiter,
  reportsController.exportAttendanceReportExcel
);

router.get("/leave", ...managerHrGuard, reportsController.getLeaveReport);
router.get("/leave/export", ...managerHrGuard, exportLimiter, reportsController.exportLeaveReportCsv);

export default router;
