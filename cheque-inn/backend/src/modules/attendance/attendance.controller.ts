import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as attendanceService from "./attendance.service";
import { parseAndValidateDateRange } from "./dateRangeValidation";
import {
  resolveAggregationUserIds,
  resolveManagerListUserIds,
  listBranchIdFromContext,
} from "../../lib/resolveScopedUserIds";
import { isBranchScopedManagerRole, isCompanyAdminRole } from "../../lib/branchAccess";
import * as usersRepo from "../users/users.repository";

export async function getToday(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const scope = await resolveAggregationUserIds(ctx, companyId);
    if (scope.error) {
      res.status(scope.error.status).json({ success: false, error: scope.error.message });
      return;
    }
    const result = await attendanceService.getTodayOverview(companyId, scope.scopedUserIds);

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getToday attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getMe(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);

    const result = await attendanceService.getMyAttendance(
      userId,
      companyId
    );

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getMe attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getMonth(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const scope = await resolveAggregationUserIds(ctx, companyId);
    if (scope.error) {
      res.status(scope.error.status).json({ success: false, error: scope.error.message });
      return;
    }
    const result = await attendanceService.getMonthlyStats(companyId, scope.scopedUserIds);

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getMonth attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getUserHistory(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: requesterId, roles } = ctx;
    const userId = routeParamString(req.params.userId);
    if (!userId) {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const safePage = page > 0 ? page : 1;
    const safeLimit =
      limit > 0 && limit <= 100
        ? limit
        : 20;

    const canViewOthers = roles.some((r) =>
      ["admin", "manager", "HR"].includes(r)
    );
    if (userId !== requesterId && !canViewOthers) {
      res.status(403).json({
        success: false,
        error: "You can only view your own attendance history",
      });
      return;
    }

    if (userId !== requesterId && canViewOthers && !isCompanyAdminRole(roles)) {
      if (isBranchScopedManagerRole(roles)) {
        if (!ctx.branchId) {
          res.status(403).json({
            success: false,
            error: "Branch context required",
          });
          return;
        }
        const target = await usersRepo.findByIdAndCompanyId(userId, companyId);
        if (!target || target.branch_id !== ctx.branchId) {
          res.status(403).json({
            success: false,
            error: "You can only view attendance for users in your branch",
          });
          return;
        }
      }
    }

    const result = await attendanceService.getUserHistory(
      userId,
      companyId,
      safePage,
      safeLimit
    );

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getUserHistory attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getActiveEmployees(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const scope = await resolveAggregationUserIds(ctx, companyId);
    if (scope.error) {
      res.status(scope.error.status).json({ success: false, error: scope.error.message });
      return;
    }
    const result = await attendanceService.getActiveEmployees(companyId, scope.scopedUserIds);

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getActiveEmployees attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getLatenessSummary(
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

    const result = await attendanceService.getLatenessSummary(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds
    );

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getLatenessSummary attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getFlagsSummary(
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

    const result = await attendanceService.getFlagsSummary(
      companyId,
      validated.start,
      validated.end,
      scope.scopedUserIds
    );

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getFlagsSummary attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getAbsenceSummary(
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

    const result = await attendanceService.getAbsenceSummary(
      companyId,
      validated.start,
      validated.end,
      listBranchId
    );

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getAbsenceSummary attendance error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}
