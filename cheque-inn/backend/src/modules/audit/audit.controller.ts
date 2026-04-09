import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as auditService from "./audit.service";

export async function getCompanyAuditLogs(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const logs = await auditService.getCompanyAuditLogs(companyId);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error("getCompanyAuditLogs error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getAuditLogsByEntity(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const entityType = routeParamString(req.params.entityType);
    const entityId = routeParamString(req.params.entityId);

    if (!entityType || !entityId) {
      res.status(400).json({
        success: false,
        error: "entityType and entityId are required",
      });
      return;
    }

    const logs = await auditService.getAuditLogsByEntity(
      companyId,
      entityType,
      entityId
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error("getAuditLogsByEntity error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
