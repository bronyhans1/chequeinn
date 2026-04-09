import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as shiftsController from "./shifts.controller";

const router = Router();

const guard = companyApiStack;
const adminManagerGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager"]),
];

router.get("/", ...guard, shiftsController.getShifts);

router.post("/", ...adminManagerGuard, shiftsController.createShift);
router.patch("/:id", ...adminManagerGuard, shiftsController.updateShift);
router.delete("/:shiftId", ...adminManagerGuard, shiftsController.deleteShift);

export default router;
