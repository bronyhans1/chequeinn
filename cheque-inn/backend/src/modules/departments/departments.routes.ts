import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as departmentsController from "./departments.controller";

const router = Router();

const adminManagerGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager"]),
];

router.post("/", ...adminManagerGuard, departmentsController.createDepartment);
router.get("/", ...adminManagerGuard, departmentsController.getDepartments);
router.get("/:id", ...adminManagerGuard, departmentsController.getDepartmentById);
router.patch("/:id", ...adminManagerGuard, departmentsController.updateDepartment);
router.delete("/:id", ...adminManagerGuard, departmentsController.deleteDepartment);

export default router;
