import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as leaveService from "./leave.service";
import * as auditService from "../audit/audit.service";
import { toLeaveApi, toLeaveApiList } from "./leave.mapper";
import { resolveManagerListUserIdsForLeave } from "../../lib/resolveScopedUserIds";

export async function requestLeave(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { userId, companyId } = getRequiredCompanyContext(req);
    const { start_date, end_date, leave_type, reason } = req.body ?? {};

    const result = await leaveService.requestLeave(userId, companyId, {
      start_date,
      end_date,
      leave_type,
      reason,
    });

    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(400).json({ success: false, error: "Failed to create leave request" });
      return;
    }
    res.status(201).json({ success: true, data: toLeaveApi(result.data) });
  } catch (err) {
    console.error("requestLeave error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getMyLeave(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.context!.userId;
    const requests = await leaveService.getMyLeaveRequests(userId);
    res.json({ success: true, data: toLeaveApiList(requests) });
  } catch (err) {
    console.error("getMyLeave error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getCompanyLeave(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const statusRaw =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const resolved = await resolveManagerListUserIdsForLeave(ctx, companyId);
    if (resolved.error) {
      res
        .status(resolved.error.status)
        .json({ success: false, error: resolved.error.message });
      return;
    }
    const requests = await leaveService.getCompanyLeaveRequests(
      companyId,
      statusRaw,
      resolved.scopedUserIds
    );
    res.json({ success: true, data: toLeaveApiList(requests) });
  } catch (err) {
    console.error("getCompanyLeave error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function approveLeave(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: approverId } = ctx;
    const leaveId = routeParamString(req.params.leaveId);

    if (!leaveId) {
      res.status(400).json({ success: false, error: "leaveId is required" });
      return;
    }

    const resolved = await resolveManagerListUserIdsForLeave(req.context!, companyId);
    if (resolved.error) {
      res
        .status(resolved.error.status)
        .json({ success: false, error: resolved.error.message });
      return;
    }

    const result = await leaveService.approveLeave(
      leaveId,
      companyId,
      approverId,
      { allowedUserIds: resolved.scopedUserIds }
    );

    if (result.error) {
      const status =
        result.error === "Leave request not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(400).json({ success: false, error: "Failed to approve leave" });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        approverId,
        "leave_approved",
        "leave_request",
        leaveId,
        { leave_request_id: leaveId }
      );
    } catch (auditErr) {
      console.error("Audit log leave_approved error", auditErr);
    }
    res.json({ success: true, data: toLeaveApi(result.data) });
  } catch (err) {
    console.error("approveLeave error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function reviewLeave(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: reviewerId } = ctx;
    const leaveId = routeParamString(req.params.leaveId);
    const action = (req.body?.action as string | undefined)?.toLowerCase();

    if (!leaveId) {
      res.status(400).json({ success: false, error: "leaveId is required" });
      return;
    }
    if (action !== "approve" && action !== "reject") {
      res.status(400).json({
        success: false,
        error: 'body.action must be "approve" or "reject"',
      });
      return;
    }

    const resolved = await resolveManagerListUserIdsForLeave(req.context!, companyId);
    if (resolved.error) {
      res
        .status(resolved.error.status)
        .json({ success: false, error: resolved.error.message });
      return;
    }

    const result = await leaveService.reviewLeave(
      leaveId,
      companyId,
      reviewerId,
      action,
      { allowedUserIds: resolved.scopedUserIds }
    );

    if (result.error) {
      const status =
        result.error === "Leave request not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(400).json({ success: false, error: "Failed to review leave" });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        reviewerId,
        action === "approve" ? "leave_approved" : "leave_rejected",
        "leave_request",
        leaveId,
        { leave_request_id: leaveId, via: "review" }
      );
    } catch (auditErr) {
      console.error("Audit log leave review error", auditErr);
    }
    res.json({ success: true, data: toLeaveApi(result.data) });
  } catch (err) {
    console.error("reviewLeave error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function rejectLeave(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: reviewerId } = ctx;
    const leaveId = routeParamString(req.params.leaveId);

    if (!leaveId) {
      res.status(400).json({ success: false, error: "leaveId is required" });
      return;
    }

    const resolved = await resolveManagerListUserIdsForLeave(ctx, companyId);
    if (resolved.error) {
      res
        .status(resolved.error.status)
        .json({ success: false, error: resolved.error.message });
      return;
    }

    const result = await leaveService.rejectLeave(leaveId, companyId, reviewerId, {
      allowedUserIds: resolved.scopedUserIds,
    });

    if (result.error) {
      const status =
        result.error === "Leave request not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(400).json({ success: false, error: "Failed to reject leave" });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        reviewerId,
        "leave_rejected",
        "leave_request",
        leaveId,
        { leave_request_id: leaveId }
      );
    } catch (auditErr) {
      console.error("Audit log leave_rejected error", auditErr);
    }
    res.json({ success: true, data: toLeaveApi(result.data) });
  } catch (err) {
    console.error("rejectLeave error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
