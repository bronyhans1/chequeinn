import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as branchesController from "./branches.controller";

const router = Router();

const base = companyApiStack;

/** List branches for assignment dropdowns (admin / manager / HR). */
const readGuard = [...base, requireRole(["admin", "manager", "HR"])];

/** Create / rename / delete branches — company admin only. */
const adminGuard = [...base, requireRole(["admin"])];

/** Any company user (employee) may validate branch QR for check-in. */
router.post(
  "/validate-qr",
  ...base,
  createRateLimit({ keyPrefix: "branches:validate-qr", windowMs: 60_000, max: 30 }),
  branchesController.validateBranchQr
);

router.get("/", ...readGuard, branchesController.getBranches);
router.post("/", ...adminGuard, branchesController.postBranch);
router.patch("/:branchId", ...adminGuard, branchesController.patchBranch);
router.delete("/:branchId", ...adminGuard, branchesController.deleteBranch);

export default router;
