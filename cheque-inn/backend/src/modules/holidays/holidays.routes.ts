import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as holidaysController from "./holidays.controller";

const router = Router();

const guard = companyApiStack;
const adminHrGuard = [...companyApiStack, requireRole(["admin", "HR"])];

router.get("/", ...guard, holidaysController.listHolidays);
router.post("/", ...adminHrGuard, holidaysController.createHoliday);
router.patch("/:id", ...adminHrGuard, holidaysController.updateHoliday);
router.delete("/:id", ...adminHrGuard, holidaysController.deleteHoliday);

export default router;
