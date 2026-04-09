import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as leaveBalanceController from "./leaveBalance.controller";

const router = Router();

const adminManagerGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];

router.get(
  "/company",
  ...adminManagerGuard,
  leaveBalanceController.getCompanyLeaveBalances
);

router.get(
  "/user/:userId",
  ...adminManagerGuard,
  leaveBalanceController.getUserLeaveBalance
);

router.post(
  "/",
  ...adminManagerGuard,
  leaveBalanceController.createLeaveBalance
);

router.patch(
  "/:id",
  ...adminManagerGuard,
  leaveBalanceController.updateLeaveBalance
);

export default router;
