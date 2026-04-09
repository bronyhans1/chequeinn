import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as attendanceController from "./attendance.controller";
import * as attendanceExportController from "./attendanceExport.controller";

const router = Router();

const guard = companyApiStack;
const managerHrGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];
const exportLimiter = createRateLimit({
  keyPrefix: "attendance:export",
  windowMs: 60_000,
  max: 8,
});

router.get(
  "/today",
  ...guard,
  attendanceController.getToday
);

router.get(
  "/me",
  ...guard,
  attendanceController.getMe
);

router.get(
  "/month",
  ...guard,
  attendanceController.getMonth
);

router.get(
  "/user/:userId",
  ...guard,
  attendanceController.getUserHistory
);

router.get(
  "/active",
  ...guard,
  attendanceController.getActiveEmployees
);

router.get(
  "/lateness-summary",
  ...managerHrGuard,
  attendanceController.getLatenessSummary
);

router.get(
  "/lateness-summary/export",
  ...managerHrGuard,
  exportLimiter,
  attendanceExportController.exportLatenessSummary
);

router.get(
  "/flags-summary",
  ...managerHrGuard,
  attendanceController.getFlagsSummary
);

router.get(
  "/flags-summary/export",
  ...managerHrGuard,
  exportLimiter,
  attendanceExportController.exportFlagsSummary
);

router.get(
  "/absence-summary",
  ...managerHrGuard,
  attendanceController.getAbsenceSummary
);

router.get(
  "/absence-summary/export",
  ...managerHrGuard,
  exportLimiter,
  attendanceExportController.exportAbsenceSummary
);

export default router;
