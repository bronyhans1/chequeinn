import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as controller from "./attendanceDayOverrides.controller";

const router = Router();

const adminHrGuard = [...companyApiStack, requireRole(["admin", "HR"])];

router.get("/classification", ...adminHrGuard, controller.getDayClassification);
router.post("/override", ...adminHrGuard, controller.upsertDayOverride);
router.delete("/override", ...adminHrGuard, controller.deleteDayOverride);

export default router;

