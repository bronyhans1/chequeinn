import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as payrollApprovalService from "./payrollApproval.service";
import * as auditService from "../audit/audit.service";

export async function approvePayrollRecord(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const id = routeParamString(req.params.id);

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }

    const result = await payrollApprovalService.approvePayrollRecord(
      id,
      companyId
    );

    if (!result.success) {
      const status = result.error?.includes("not found") ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        userId,
        "payroll_approved",
        "payroll_record",
        id,
        { payroll_record_id: id }
      );
    } catch (auditErr) {
      console.error("Audit log payroll_approved error", auditErr);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("approvePayrollRecord error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function lockPayrollRecord(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const id = routeParamString(req.params.id);

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }

    const result = await payrollApprovalService.lockPayrollRecord(
      id,
      companyId
    );

    if (!result.success) {
      const status = result.error?.includes("not found") ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        userId,
        "payroll_locked",
        "payroll_record",
        id,
        { payroll_record_id: id }
      );
    } catch (auditErr) {
      console.error("Audit log payroll_locked error", auditErr);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("lockPayrollRecord error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
