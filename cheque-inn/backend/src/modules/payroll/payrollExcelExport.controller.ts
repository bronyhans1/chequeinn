import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as payrollExcelExportService from "./payrollExcelExport.service";

export async function exportMonthlyPayrollExcel(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      res.status(400).json({
        success: false,
        error: "Valid year (2000-2100) is required",
      });
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({
        success: false,
        error: "Valid month (1-12) is required",
      });
      return;
    }

    const buffer = await payrollExcelExportService.exportMonthlyPayrollExcel(
      companyId,
      year,
      month
    );

    const filename = `payroll-${year}-${String(month).padStart(2, "0")}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send(buffer);
  } catch (err) {
    console.error("exportMonthlyPayrollExcel error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
