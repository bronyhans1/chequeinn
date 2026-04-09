import { Response, NextFunction } from "express";
import { ContextRequest } from "./context.middleware";
import * as companyPolicyService from "../modules/companyPolicy/companyPolicy.service";

/**
 * Blocks payroll/wage/earnings HTTP endpoints when the company has disabled payroll.
 * Must run after auth + context + requireCompanyContext.
 */
export async function requirePayrollEnabled(
  req: ContextRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.context?.companyId;
    if (!companyId) {
      res.status(403).json({ success: false, error: "Company context required" });
      return;
    }
    const enabled = await companyPolicyService.isPayrollEnabled(companyId);
    if (!enabled) {
      res.status(403).json({
        success: false,
        error: "Payroll is disabled for this company",
        code: "PAYROLL_DISABLED",
      });
      return;
    }
    next();
  } catch (e) {
    console.error("requirePayrollEnabled error", e);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
