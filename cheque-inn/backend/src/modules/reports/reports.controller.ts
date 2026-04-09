import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { parseAndValidateDateRange } from "../attendance/dateRangeValidation";
import {
  resolveReportUserScope,
  assertUserIdAllowedForScope,
} from "./reportScope";
import * as attendanceReportService from "./attendanceReport.service";
import * as leaveReportService from "./leaveReport.service";

function parsePageLimit(req: ContextRequest): { page: number; limit: number } {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;
  return {
    page: page > 0 ? page : 1,
    limit: limit > 0 && limit <= 500 ? limit : 100,
  };
}

export async function getAttendanceReport(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const userId =
      typeof req.query.user_id === "string" && req.query.user_id.trim()
        ? req.query.user_id.trim()
        : undefined;
    const branchId = req.query.branch_id as string | undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveReportUserScope(ctx, companyId, branchId);
    if (scope.error) {
      res
        .status(scope.error.status)
        .json({ success: false, error: scope.error.message });
      return;
    }

    const gate = assertUserIdAllowedForScope(userId, scope.scopedUserIds);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const { page, limit } = parsePageLimit(req);
    const data = await attendanceReportService.getAttendanceReportPage(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds,
      userId,
      page,
      limit
    );

    res.json({
      success: true,
      data: {
        ...data,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("getAttendanceReport error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function exportAttendanceReportCsv(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const userId =
      typeof req.query.user_id === "string" && req.query.user_id.trim()
        ? req.query.user_id.trim()
        : undefined;
    const branchId = req.query.branch_id as string | undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveReportUserScope(ctx, companyId, branchId);
    if (scope.error) {
      res
        .status(scope.error.status)
        .json({ success: false, error: scope.error.message });
      return;
    }

    const gate = assertUserIdAllowedForScope(userId, scope.scopedUserIds);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const { csv } = await attendanceReportService.buildAttendanceReportCsv(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds,
      userId
    );

    const filename = `attendance-report-${validated.start}-to-${validated.end}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send("\uFEFF" + csv);
  } catch (err) {
    console.error("exportAttendanceReportCsv error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function exportAttendanceReportExcel(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const userId =
      typeof req.query.user_id === "string" && req.query.user_id.trim()
        ? req.query.user_id.trim()
        : undefined;
    const branchId = req.query.branch_id as string | undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveReportUserScope(ctx, companyId, branchId);
    if (scope.error) {
      res
        .status(scope.error.status)
        .json({ success: false, error: scope.error.message });
      return;
    }

    const gate = assertUserIdAllowedForScope(userId, scope.scopedUserIds);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const buffer = await attendanceReportService.buildAttendanceReportExcel(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds,
      userId
    );

    const filename = `attendance-report-${validated.start}-to-${validated.end}.xlsx`;
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
    console.error("exportAttendanceReportExcel error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getLeaveReport(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const userId =
      typeof req.query.user_id === "string" && req.query.user_id.trim()
        ? req.query.user_id.trim()
        : undefined;
    const branchId = req.query.branch_id as string | undefined;
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveReportUserScope(ctx, companyId, branchId);
    if (scope.error) {
      res
        .status(scope.error.status)
        .json({ success: false, error: scope.error.message });
      return;
    }

    const gate = assertUserIdAllowedForScope(userId, scope.scopedUserIds);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const { page, limit } = parsePageLimit(req);
    const data = await leaveReportService.getLeaveReportPage(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds,
      userId,
      status,
      page,
      limit
    );

    res.json({
      success: true,
      data: {
        ...data,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("getLeaveReport error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function exportLeaveReportCsv(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const userId =
      typeof req.query.user_id === "string" && req.query.user_id.trim()
        ? req.query.user_id.trim()
        : undefined;
    const branchId = req.query.branch_id as string | undefined;
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : undefined;

    const validated = parseAndValidateDateRange(start, end);
    if ("error" in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const scope = await resolveReportUserScope(ctx, companyId, branchId);
    if (scope.error) {
      res
        .status(scope.error.status)
        .json({ success: false, error: scope.error.message });
      return;
    }

    const gate = assertUserIdAllowedForScope(userId, scope.scopedUserIds);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const { csv } = await leaveReportService.buildLeaveReportCsv(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds,
      userId,
      status
    );

    const filename = `leave-report-${validated.start}-to-${validated.end}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send("\uFEFF" + csv);
  } catch (err) {
    console.error("exportLeaveReportCsv error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
