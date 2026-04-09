import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { requirePayrollEnabled } from "../../middleware/requirePayrollEnabled.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as wageRatesController from "./wageRates.controller";

const router = Router();

const baseGuard = [...companyApiStack, requirePayrollEnabled];

const adminHrGuard = [
  ...companyApiStack,
  requirePayrollEnabled,
  requireRole(["admin", "HR"]),
];

router.post("/", ...adminHrGuard, wageRatesController.createWageRate);
router.get("/user/:userId", ...baseGuard, wageRatesController.getUserWageRates);
router.patch("/:id", ...adminHrGuard, wageRatesController.updateWageRate);
router.delete("/:id", ...adminHrGuard, wageRatesController.deleteWageRate);

export default router;
