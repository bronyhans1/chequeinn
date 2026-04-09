import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as usersRepo from "../users/users.repository";
import * as salaryEarningsService from "./salaryEarnings.service";

function routeParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) return value[0];
  return undefined;
}

export async function getMyEarnings(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const data = await salaryEarningsService.getCurrentEarningsSummary(userId, companyId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getMyEarnings error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getUserEarnings(req: ContextRequest, res: Response): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const targetId = routeParam(req.params.userId);
    if (!targetId) {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }

    const roles = req.context!.roles ?? [];
    const isAdmin = roles.includes("admin");
    const isHR = roles.includes("HR");
    if (!isAdmin && !isHR) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    if (!isAdmin && isHR) {
      const target = await usersRepo.findByIdAndCompanyId(targetId, companyId);
      if (!target || target.branch_id !== ctx.branchId) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }
    } else {
      const target = await usersRepo.findByIdAndCompanyId(targetId, companyId);
      if (!target) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }
    }

    const data = await salaryEarningsService.getCurrentEarningsSummary(targetId, companyId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getUserEarnings error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
