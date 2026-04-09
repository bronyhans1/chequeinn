import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as sessionsController from "./sessions.controller";

const router = Router();

const baseGuard = companyApiStack;
const managerGuard = [...companyApiStack, requireRole(["admin", "manager"])];

const managerHrGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];

const selfClockLimiter = createRateLimit({
  keyPrefix: "sessions:self-clock",
  windowMs: 60_000,
  max: 10,
});
const manualClockLimiter = createRateLimit({
  keyPrefix: "sessions:manual-clock",
  windowMs: 60_000,
  max: 20,
});

// User self clock-in/out
router.post(
  "/clock-in",
  ...baseGuard,
  selfClockLimiter,
  sessionsController.clockIn
);

router.post(
  "/clock-out",
  ...baseGuard,
  selfClockLimiter,
  sessionsController.clockOut
);

// Admin / manager / HR: manual clock in/out (branch-scoped in controller)
router.post(
  "/manual-clock-in",
  ...managerHrGuard,
  manualClockLimiter,
  sessionsController.manualClockIn
);

router.post(
  "/manual-clock-out",
  ...managerHrGuard,
  manualClockLimiter,
  sessionsController.manualClockOut
);

// Today's sessions
router.get(
  "/today",
  ...baseGuard,
  sessionsController.getTodaySessionsForUser
);

router.get(
  "/company",
  ...managerGuard,
  sessionsController.getTodaySessionsForCompany
);

// Paginated session history (enriched with branch + department name; company view includes employee)
router.get(
  "/history/company",
  ...managerHrGuard,
  sessionsController.getCompanySessionHistory
);

router.get(
  "/history",
  ...baseGuard,
  sessionsController.getMySessionHistory
);

export default router;
