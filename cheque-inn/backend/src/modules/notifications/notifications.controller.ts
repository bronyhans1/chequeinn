import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as service from "./notifications.service";

export async function listMine(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { rows, total } = await service.listMyNotifications(companyId, userId, page, limit);
    res.json({ success: true, data: { rows, total, page, limit } });
  } catch (err) {
    console.error("listNotifications error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function unreadCount(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const count = await service.getUnreadCount(companyId, userId);
    res.json({ success: true, data: { unread: count } });
  } catch (err) {
    console.error("unreadCount error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function markRead(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const id = routeParamString(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }
    const row = await service.markNotificationRead(companyId, userId, id);
    if (!row) {
      res.status(404).json({ success: false, error: "Notification not found" });
      return;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error("markRead error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function markAllRead(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const updated = await service.markAllNotificationsRead(companyId, userId);
    res.json({ success: true, data: { marked: updated } });
  } catch (err) {
    console.error("markAllRead error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
