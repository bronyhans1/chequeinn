import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as departmentsService from "./departments.service";
import { listBranchIdFromContext } from "../../lib/resolveScopedUserIds";
import { isBranchScopedManagerRole, isCompanyAdminRole } from "../../lib/branchAccess";
import { logAction } from "../audit/audit.service";

function trimUnknown(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export async function createDepartment(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId } = ctx;
    const name = trimUnknown(req.body?.name);
    const branch_id = trimUnknown(req.body?.branch_id);

    if (!name) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }

    if (isBranchScopedManagerRole(ctx.roles) && !ctx.branchId) {
      res.status(403).json({
        success: false,
        error: "Branch context required for this role",
      });
      return;
    }

    const result = isCompanyAdminRole(ctx.roles)
      ? await departmentsService.createDepartment(companyId, {
          name,
          ...(branch_id ? { branch_id } : {}),
        })
      : await departmentsService.createDepartment(
          companyId,
          { name },
          { forceBranchId: ctx.branchId! }
        );

    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
    await logAction(companyId, userId, "department.create", "department", result.data!.id, {
      branch_id: result.data?.branch_id ?? null,
    });
  } catch (err) {
    console.error("createDepartment error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getDepartments(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const listBranchId = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !listBranchId) {
      res.status(403).json({
        success: false,
        error: "Branch context required for this role",
      });
      return;
    }
    const departments = await departmentsService.listDepartments(
      companyId,
      listBranchId
    );

    res.json({ success: true, data: departments });
  } catch (err) {
    console.error("getDepartments error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getDepartmentById(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const id = routeParamString(req.params.id);

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }

    const restrictBranch = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !restrictBranch) {
      res.status(403).json({
        success: false,
        error: "Branch context required for this role",
      });
      return;
    }

    const department = await departmentsService.getDepartmentById(
      id,
      companyId,
      restrictBranch
    );

    if (!department) {
      res.status(404).json({ success: false, error: "Department not found" });
      return;
    }

    res.json({ success: true, data: department });
  } catch (err) {
    console.error("getDepartmentById error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

function isCompanyAdmin(req: ContextRequest): boolean {
  return !!req.context?.roles?.includes("admin");
}

export async function updateDepartment(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId } = ctx;
    const id = routeParamString(req.params.id);
    const name = trimUnknown(req.body?.name);

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const branchKeyPresent = Object.prototype.hasOwnProperty.call(
      body,
      "branch_id"
    );
    if (branchKeyPresent && !isCompanyAdmin(req)) {
      res.status(403).json({
        success: false,
        error: "Only company admins can change a department's branch",
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

    const restrictBranch = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !restrictBranch) {
      res.status(403).json({
        success: false,
        error: "Branch context required for this role",
      });
      return;
    }

    const result = await departmentsService.updateDepartment(
      id,
      companyId,
      {
        name,
        ...(branch_id !== undefined ? { branch_id } : {}),
      },
      restrictBranch
    );

    if (result.error) {
      if (result.error === "Department not found") {
        res.status(404).json({ success: false, error: result.error });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
      return;
    }

    res.json({ success: true, data: result.data });
    await logAction(companyId, userId, "department.update", "department", id, {
      name_updated: name !== undefined,
      branch_updated: branch_id !== undefined,
    });
  } catch (err) {
    console.error("updateDepartment error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteDepartment(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId, userId } = ctx;
    const id = routeParamString(req.params.id);

    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }
    const restrictBranch = listBranchIdFromContext(ctx);
    if (isBranchScopedManagerRole(ctx.roles) && !restrictBranch) {
      res.status(403).json({
        success: false,
        error: "Branch context required for this role",
      });
      return;
    }

    const result = await departmentsService.deleteDepartment(
      id,
      companyId,
      restrictBranch
    );

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error ?? "Department not found",
      });
      return;
    }

    res.json({ success: true, data: null });
    await logAction(companyId, userId, "department.delete", "department", id);
  } catch (err) {
    console.error("deleteDepartment error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
