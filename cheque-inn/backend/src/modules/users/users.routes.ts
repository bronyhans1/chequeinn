import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as usersController from "./users.controller";

const router = Router();

const viewGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];
/** Same as view: company admins/managers/HR manage employees (no invite flow yet). */
const employeeWriteGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];

router.get("/", ...viewGuard, usersController.getUsers);
router.get("/:id", ...viewGuard, usersController.getUserById);
router.post(
  "/",
  ...employeeWriteGuard,
  createRateLimit({ keyPrefix: "users:create", windowMs: 60_000, max: 12 }),
  usersController.createUser
);
router.patch(
  "/:userId/shift",
  ...employeeWriteGuard,
  createRateLimit({ keyPrefix: "users:assign-shift", windowMs: 60_000, max: 20 }),
  usersController.assignShift
);
router.patch(
  "/:id",
  ...employeeWriteGuard,
  createRateLimit({ keyPrefix: "users:update", windowMs: 60_000, max: 30 }),
  usersController.updateUser
);
router.delete(
  "/:id",
  ...employeeWriteGuard,
  createRateLimit({ keyPrefix: "users:delete", windowMs: 60_000, max: 10 }),
  usersController.deleteUser
);

export default router;
