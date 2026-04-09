import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as payrollReportsService from "./payrollReports.service";
import * as payrollSyncFailuresRepo from "./payrollSyncFailures.repository";

export async function getMe(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { userId, companyId } = getRequiredCompanyContext(req);

    const result = await payrollReportsService.getUserPayroll(userId, companyId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("getMe payroll error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getCompany(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);

    const result = await payrollReportsService.getCompanyPayroll(companyId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("getCompany payroll error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getMonth(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      res.status(400).json({ success: false, error: "Valid year (YYYY) is required" });
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: "Valid month (1-12) is required" });
      return;
    }

    const result = await payrollReportsService.getMonthlyPayroll(
      companyId,
      year,
      month
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("getMonth payroll error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getRecentPayrollSyncFailures(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
    const rows = await payrollSyncFailuresRepo.listRecentForCompany(companyId, limit);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getRecentPayrollSyncFailures error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
