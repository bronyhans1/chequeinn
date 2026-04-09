import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as companyPolicyController from "./companyPolicy.controller";

const router = Router();

const guard = companyApiStack;
const policyUpdateGuard = [
  ...companyApiStack,
  requireRole(["admin", "manager", "HR"]),
];

router.get("/", ...guard, companyPolicyController.getPolicy);
router.patch("/", ...policyUpdateGuard, companyPolicyController.updatePolicy);

export default router;
