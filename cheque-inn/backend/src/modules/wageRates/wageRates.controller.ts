import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as wageRatesService from "./wageRates.service";
import * as wageRatesRepo from "./wageRates.repository";
import * as auditService from "../audit/audit.service";
import * as usersRepo from "../users/users.repository";
import * as salaryResync from "../payroll/salaryEarnings.resync";

function routeUserId(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) return value[0];
  return undefined;
}

function routeIdParam(value: string | string[] | undefined): string | undefined {
  return routeUserId(value);
}

function canViewUserWageRates(req: ContextRequest, targetUserId: string): boolean {
  const roles = req.context!.roles ?? [];
  const isAdmin = roles.includes("admin");
  if (req.context!.userId === targetUserId) return true;
  if (!isAdmin && !roles.includes("HR")) return false;
  return true;
}

async function assertHrCanAccessTarget(
  req: ContextRequest,
  companyId: string,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const roles = req.context!.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isHR = roles.includes("HR");
  if (!isAdmin && isHR) {
    const target = await usersRepo.findByIdAndCompanyId(targetUserId, companyId);
    if (!target || target.branch_id !== req.context!.branchId) {
      return { ok: false, status: 404, msg: "User not found" };
    }
  } else if (!isAdmin) {
    return { ok: false, status: 403, msg: "Forbidden" };
  } else {
    const target = await usersRepo.findByIdAndCompanyId(targetUserId, companyId);
    if (!target) return { ok: false, status: 404, msg: "User not found" };
  }
  return { ok: true };
}

export async function createWageRate(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId: actorUserId } = getRequiredCompanyContext(req);
    const body = req.body ?? {};
    const {
      user_id,
      rate_type,
      hourly_rate,
      monthly_salary,
      effective_from,
      salary_divisor_type,
      salary_divisor_value,
    } = body;

    const targetUserId = typeof user_id === "string" ? user_id.trim() : "";
    if (targetUserId) {
      const gate = await assertHrCanAccessTarget(req, companyId, targetUserId);
      if (!gate.ok) {
        res.status(gate.status).json({ success: false, error: gate.msg });
        return;
      }
    }

    const result = await wageRatesService.createWageRate(companyId, {
      user_id,
      rate_type,
      hourly_rate,
      monthly_salary,
      effective_from,
      salary_divisor_type,
      salary_divisor_value,
    });

    if (result.error) {
      const status = result.error === "User not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(400).json({ success: false, error: "Failed to create wage rate" });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        actorUserId,
        "wage_rate_created",
        "wage_rate",
        result.data.id,
        {
          user_id: result.data.user_id,
          rate_type: result.data.rate_type,
          hourly_rate: result.data.hourly_rate,
          monthly_salary: result.data.monthly_salary,
          salary_divisor_type: result.data.salary_divisor_type,
          salary_divisor_value: result.data.salary_divisor_value,
          effective_from: result.data.effective_from,
        }
      );
    } catch (auditErr) {
      console.error("Audit log wage_rate_created error", auditErr);
    }
    salaryResync.scheduleUserMonthlySalaryResync(companyId, result.data.user_id, {
      newEffectiveYmd: result.data.effective_from.slice(0, 10),
    });
    res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("createWageRate error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getUserWageRates(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const userId = routeUserId(req.params.userId);

    if (!userId) {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }

    if (!canViewUserWageRates(req, userId)) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    if (req.context!.userId !== userId) {
      const gate = await assertHrCanAccessTarget(req, companyId, userId);
      if (!gate.ok) {
        res.status(gate.status).json({ success: false, error: gate.msg });
        return;
      }
    } else {
      const self = await usersRepo.findByIdAndCompanyId(userId, companyId);
      if (!self) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }
    }

    const result = await wageRatesService.getUserWageRates(userId, companyId);

    if (result.error) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: result.data ?? [] });
  } catch (err) {
    console.error("getUserWageRates error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function updateWageRate(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId: actorUserId } = getRequiredCompanyContext(req);
    const id = routeIdParam(req.params.id);
    const body = req.body ?? {};

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }

    const prior = await wageRatesRepo.getWageRateById(id, companyId);
    if (!prior) {
      res.status(404).json({ success: false, error: "Wage rate not found" });
      return;
    }
    const updateGate = await assertHrCanAccessTarget(req, companyId, prior.user_id);
    if (!updateGate.ok) {
      res.status(updateGate.status).json({ success: false, error: updateGate.msg });
      return;
    }

    const result = await wageRatesService.updateWageRate(id, companyId, {
      hourly_rate: body.hourly_rate,
      monthly_salary: body.monthly_salary,
      effective_from: body.effective_from,
      rate_type: body.rate_type,
      salary_divisor_type: body.salary_divisor_type,
      salary_divisor_value: body.salary_divisor_value,
    });

    if (result.error) {
      const status = result.error === "Wage rate not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(404).json({ success: false, error: "Wage rate not found" });
      return;
    }
    try {
      await auditService.logAction(companyId, actorUserId, "wage_rate_updated", "wage_rate", id, {
        rate_type: result.data.rate_type,
        hourly_rate: result.data.hourly_rate,
        monthly_salary: result.data.monthly_salary,
        salary_divisor_type: result.data.salary_divisor_type,
        salary_divisor_value: result.data.salary_divisor_value,
        effective_from: result.data.effective_from,
      });
    } catch (auditErr) {
      console.error("Audit log wage_rate_updated error", auditErr);
    }
    if (result.data) {
      salaryResync.scheduleUserMonthlySalaryResync(companyId, result.data.user_id, {
        newEffectiveYmd: result.data.effective_from.slice(0, 10),
        ...(prior ? { oldEffectiveYmd: prior.effective_from.slice(0, 10) } : {}),
      });
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("updateWageRate error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteWageRate(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId: actorUserId } = getRequiredCompanyContext(req);
    const id = routeIdParam(req.params.id);

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }

    const existingRow = await wageRatesRepo.getWageRateById(id, companyId);
    if (!existingRow) {
      res.status(404).json({ success: false, error: "Wage rate not found" });
      return;
    }
    const deleteGate = await assertHrCanAccessTarget(req, companyId, existingRow.user_id);
    if (!deleteGate.ok) {
      res.status(deleteGate.status).json({ success: false, error: deleteGate.msg });
      return;
    }

    const result = await wageRatesService.deleteWageRate(id, companyId);

    if (result.error) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        actorUserId,
        "wage_rate_deleted",
        "wage_rate",
        id,
        { wage_rate_id: id }
      );
    } catch (auditErr) {
      console.error("Audit log wage_rate_deleted error", auditErr);
    }
    if (result.data?.deleted) {
      salaryResync.scheduleUserMonthlySalaryResync(companyId, result.data.user_id, {
        oldEffectiveYmd: result.data.effective_from.slice(0, 10),
      });
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("deleteWageRate error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
