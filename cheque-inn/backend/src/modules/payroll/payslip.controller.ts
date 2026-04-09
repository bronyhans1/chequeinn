import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as payslipService from "./payslip.service";

export async function getPayslip(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const payrollId = routeParamString(req.params.payrollId);

    if (!payrollId) {
      res.status(400).json({ success: false, error: "payrollId is required" });
      return;
    }

    const result = await payslipService.generatePayslip(payrollId, companyId);

    if (!result) {
      res.status(404).json({ success: false, error: "Payroll record not found" });
      return;
    }

    const filename = `payslip-${payrollId.slice(0, 8)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send(result.buffer);
  } catch (err) {
    console.error("getPayslip error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
