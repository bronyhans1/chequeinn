import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { parseAndValidateDateRange } from "./dateRangeValidation";
import * as attendanceExportService from "./attendanceExport.service";
import {
  resolveManagerListUserIds,
  listBranchIdFromContext,
} from "../../lib/resolveScopedUserIds";
import { isBranchScopedManagerRole } from "../../lib/branchAccess";

export async function exportLatenessSummary(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveManagerListUserIds(ctx, companyId);
    if (scope.error) {
      res.status(scope.error.status).json({ success: false, error: scope.error.message });
      return;
    }

    const buffer = await attendanceExportService.exportLatenessSummaryExcel(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds
    );

    const filename = `attendance-lateness-summary-${validated.start}-to-${validated.end}.xlsx`;
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
    console.error("exportLatenessSummary error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function exportFlagsSummary(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveManagerListUserIds(ctx, companyId);
    if (scope.error) {
      res.status(scope.error.status).json({ success: false, error: scope.error.message });
      return;
    }

    const buffer = await attendanceExportService.exportFlagsSummaryExcel(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds
    );

    const filename = `attendance-flags-summary-${validated.start}-to-${validated.end}.xlsx`;
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
    console.error("exportFlagsSummary error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function exportAbsenceSummary(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const listBranchId = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !listBranchId) {
      res.status(403).json({ success: false, error: "Branch context required for this role" });
      return;
    }

    const buffer = await attendanceExportService.exportAbsenceSummaryExcel(
      companyId,
      validated.start,
      validated.end,
      listBranchId
    );

    const filename = `attendance-absence-summary-${validated.start}-to-${validated.end}.xlsx`;
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
    console.error("exportAbsenceSummary error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
