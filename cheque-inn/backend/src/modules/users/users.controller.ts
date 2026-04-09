import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as usersService from "./users.service";
import { listBranchIdFromContext } from "../../lib/resolveScopedUserIds";
import { isBranchScopedManagerRole } from "../../lib/branchAccess";
import { logAction } from "../audit/audit.service";

function trimString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

/** Express 5 types `req.params.*` as `string | string[]`. */
function routeParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) return value[0];
  return undefined;
}

function isCompanyAdmin(req: ContextRequest): boolean {
  return !!req.context?.roles?.includes("admin");
}

/** Only admin or manager may set/clear `department_id`. HR may not. */
function canAssignDepartment(req: ContextRequest): boolean {
  const roles = req.context?.roles ?? [];
  if (roles.includes("admin")) return true;
  if (roles.includes("manager")) return true;
  return false;
}

/** Only company admin or HR may change account status (not managers). */
function canChangeUserAccountStatus(req: ContextRequest): boolean {
  const roles = req.context?.roles ?? [];
  return roles.includes("admin") || roles.includes("HR");
}

/** Manager/HR may only mutate users in their branch; admin has no restriction. */
function restrictBranchForManagers(req: ContextRequest): string | undefined {
  if (isCompanyAdmin(req)) return undefined;
  if (isBranchScopedManagerRole(req.context!.roles)) {
    return req.context!.branchId ?? undefined;
  }
  return undefined;
}

export async function getUsers(req: ContextRequest, res: Response): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const listBranchId = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !listBranchId) {
      res.status(403).json({ success: false, error: "Branch context required for this role" });
      return;
    }
    const users = await usersService.listEmployees(companyId, listBranchId);
    res.json({ success: true, data: users });
  } catch (err) {
    console.error("getUsers error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getUserById(req: ContextRequest, res: Response): Promise<void> {
  try {
    const id = routeParam(req.params.id);
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const listBranchId = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !listBranchId) {
      res.status(403).json({ success: false, error: "Branch context required for this role" });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, error: "User id is required" });
      return;
    }

    const user = await usersService.getEmployeeById(id, companyId, listBranchId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    console.error("getUserById error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function createUser(req: ContextRequest, res: Response): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: actorUserId } = ctx;
    const first_name = trimString(req.body?.first_name);
    const last_name = trimString(req.body?.last_name);
    const email = trimString(req.body?.email);
    const temporary_password =
      typeof req.body?.temporary_password === "string"
        ? req.body.temporary_password
        : "";
    const role = trimString(req.body?.role);
    const branch_id = trimString(req.body?.branch_id);

    if (!first_name) {
      res.status(400).json({ success: false, error: "first_name is required" });
      return;
    }
    if (!last_name) {
      res.status(400).json({ success: false, error: "last_name is required" });
      return;
    }
    if (!email) {
      res.status(400).json({ success: false, error: "email is required" });
      return;
    }

    let forceBranchId: string | undefined;
    if (!isCompanyAdmin(req) && isBranchScopedManagerRole(req.context!.roles)) {
      if (!req.context!.branchId) {
        res.status(403).json({ success: false, error: "Branch context required for this role" });
        return;
      }
      forceBranchId = req.context!.branchId;
    }

    const result = await usersService.createEmployee(
      companyId,
      {
        first_name,
        last_name,
        email,
        temporary_password,
        role: role ?? "",
        ...(branch_id && isCompanyAdmin(req) ? { branch_id } : {}),
      },
      forceBranchId
    );

    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.status(201).json({ success: true, data: result.user });
    await logAction(companyId, actorUserId, "user.create", "user", result.user!.id, {
      role: role ?? "",
      branch_id: result.user?.branch_id ?? null,
    });
  } catch (err) {
    console.error("createUser error:", err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function updateUser(req: ContextRequest, res: Response): Promise<void> {
  try {
    const id = routeParam(req.params.id);
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: actorUserId } = ctx;
    if (!id) {
      res.status(400).json({ success: false, error: "User id is required" });
      return;
    }
    const first_name = trimString(req.body?.first_name);
    const last_name = trimString(req.body?.last_name);
    const email = trimString(req.body?.email);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const branchKeyPresent = Object.prototype.hasOwnProperty.call(body, "branch_id");
    if (branchKeyPresent && !isCompanyAdmin(req)) {
      res.status(403).json({
        success: false,
        error: "Only company admins can change an employee's branch",
      });
      return;
    }
    let branch_id: string | undefined;
    if (branchKeyPresent) {
      const raw = body.branch_id;
      if (typeof raw !== "string" || !raw.trim()) {
        res.status(400).json({
          success: false,
          error: "branch_id must be a non-empty string",
        });
        return;
      }
      branch_id = raw.trim();
    }

    const statusKeyPresent = Object.prototype.hasOwnProperty.call(body, "status");
    if (statusKeyPresent && !canChangeUserAccountStatus(req)) {
      res.status(403).json({
        success: false,
        error: "Only company admins and HR can change employee status",
      });
      return;
    }

    const departmentKeyPresent = Object.prototype.hasOwnProperty.call(body, "department_id");
    let department_id: string | null | undefined = undefined;
    if (departmentKeyPresent) {
      if (!canAssignDepartment(req)) {
        res.status(403).json({
          success: false,
          error: "Only company admins and managers can assign departments",
        });
        return;
      }
      const rawDept = body.department_id;
      if (rawDept === null) {
        department_id = null;
      } else if (typeof rawDept === "string") {
        const t = rawDept.trim();
        department_id = t === "" ? null : t;
      } else {
        res.status(400).json({
          success: false,
          error: "department_id must be a string, null, or omitted",
        });
        return;
      }
    }

    let status: "active" | "inactive" | "suspended" | undefined = undefined;
    if (statusKeyPresent) {
      const raw = body.status;
      if (raw !== "active" && raw !== "inactive" && raw !== "suspended") {
        res.status(400).json({
          success: false,
          error: "status must be one of: active, inactive, suspended",
        });
        return;
      }
      status = raw;
    }

    const restrict = restrictBranchForManagers(req);
    if (restrict === undefined && isBranchScopedManagerRole(ctx.roles) && !ctx.branchId) {
      res.status(403).json({ success: false, error: "Branch context required for this role" });
      return;
    }

    const result = await usersService.updateEmployee(
      id,
      companyId,
      {
        first_name,
        last_name,
        email,
        ...(branch_id !== undefined ? { branch_id } : {}),
        ...(departmentKeyPresent ? { department_id } : {}),
        ...(statusKeyPresent ? { status } : {}),
      },
      restrict
    );

    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    if (!result.user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: result.user });
    await logAction(companyId, actorUserId, "user.update", "user", id, {
      first_name_updated: first_name !== undefined,
      last_name_updated: last_name !== undefined,
      email_updated: email !== undefined,
      branch_updated: branch_id !== undefined,
      department_updated: departmentKeyPresent,
      status_updated: statusKeyPresent,
      ...(statusKeyPresent && status !== undefined ? { status } : {}),
      ...(result.audit?.department_auto_cleared ? { department_auto_cleared: true } : {}),
    });
  } catch (err) {
    console.error("updateUser error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteUser(req: ContextRequest, res: Response): Promise<void> {
  try {
    const id = routeParam(req.params.id);
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: actorUserId } = ctx;
    if (!id) {
      res.status(400).json({ success: false, error: "User id is required" });
      return;
    }
    const restrict = restrictBranchForManagers(req);
    if (restrict === undefined && isBranchScopedManagerRole(ctx.roles) && !ctx.branchId) {
      res.status(403).json({ success: false, error: "Branch context required for this role" });
      return;
    }

    const result = await usersService.softDeleteEmployee(id, companyId, restrict, {
      userId: actorUserId,
      roles: ctx.roles,
    });

    if (!result.success) {
      const status =
        result.error === "User not found"
          ? 404
          : result.error.includes("cannot delete")
            ? 403
            : result.error.includes("Only company admins")
              ? 403
              : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }

    if (result.outcome === "permanently_deleted") {
      res.json({ success: true, data: { outcome: "permanently_deleted" as const } });
      await logAction(companyId, actorUserId, "user.delete", "user", id);
      return;
    }

    res.json({
      success: true,
      data: {
        outcome: "deactivated_due_to_records" as const,
        message: result.message,
      },
    });
    await logAction(companyId, actorUserId, "user.deactivate", "user", id, {
      reason: "delete_blocked_historical_records",
    });
  } catch (err) {
    console.error("deleteUser error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function assignShift(req: ContextRequest, res: Response): Promise<void> {
  try {
    const targetUserId = routeParam(req.params.userId);
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId: actorUserId } = ctx;
    const shiftId = req.body?.shift_id !== undefined ? req.body.shift_id : undefined;

    if (targetUserId === undefined || targetUserId === "") {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }

    const restrict = restrictBranchForManagers(req);
    if (restrict === undefined && isBranchScopedManagerRole(ctx.roles) && !ctx.branchId) {
      res.status(403).json({ success: false, error: "Branch context required for this role" });
      return;
    }

    const result = await usersService.assignShift(
      targetUserId,
      companyId,
      shiftId === undefined ? null : shiftId,
      restrict
    );

    if (result.error) {
      const status = result.error === "User not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    if (!result.user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: result.user });
    await logAction(companyId, actorUserId, "user.assign_shift", "user", targetUserId, {
      shift_id: shiftId === undefined ? null : shiftId,
    });
  } catch (err) {
    console.error("assignShift error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
