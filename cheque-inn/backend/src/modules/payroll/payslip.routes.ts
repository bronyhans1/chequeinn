import { Router } from "express";
import { requirePayrollEnabled } from "../../middleware/requirePayrollEnabled.middleware";
import { companyApiStack } from "../../middleware/standardGuards";
import * as payslipController from "./payslip.controller";

const router = Router();

const guard = [...companyApiStack, requirePayrollEnabled];

router.get("/payslip/:payrollId", ...guard, payslipController.getPayslip);

export default router;
