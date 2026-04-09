import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as branchesService from "./branches.service";
import { isBranchScopedManagerRole, isCompanyAdminRole } from "../../lib/branchAccess";
import { isQrAttendanceLocationForbiddenError } from "../../constants/employeeAttendanceMessages";
import { logAction } from "../audit/audit.service";

function trimString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function routeParamId(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const s = Array.isArray(value) ? value[0] : value;
  return typeof s === "string" && s.trim() ? s.trim() : undefined;
}

export async function getBranches(req: ContextRequest, res: Response): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    let data: Awaited<ReturnType<typeof branchesService.listBranches>>;
    if (isCompanyAdminRole(ctx.roles)) {
      data = await branchesService.listBranches(companyId);
    } else if (isBranchScopedManagerRole(ctx.roles)) {
      if (!ctx.branchId) {
        res.status(403).json({
          success: false,
          error: "Branch context required for this role",
        });
        return;
      }
      data = await branchesService.listBranches(companyId, ctx.branchId);
    } else {
      data = await branchesService.listBranches(companyId);
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error("getBranches error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function postBranch(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const name = trimString(req.body?.name);
    if (!name) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }
    const result = await branchesService.createBranch(companyId, name);
    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.status(201).json({ success: true, data: result.data });
    await logAction(companyId, userId, "branch.create", "branch", result.data!.id, {
      name: result.data?.name ?? name,
    });
  } catch (err) {
    console.error("postBranch error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function patchBranch(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const branchId = routeParamId(req.params.branchId);
    if (!branchId) {
      res.status(400).json({ success: false, error: "branchId is required" });
      return;
    }
    const nameRaw = req.body?.name;
    const name = nameRaw !== undefined && nameRaw !== null ? trimString(nameRaw) : undefined;
    const latRaw = req.body?.latitude;
    const lonRaw = req.body?.longitude;
    const radRaw = req.body?.radius_meters;
    const hasAttendance =
      latRaw !== undefined || lonRaw !== undefined || radRaw !== undefined;
    const latitude =
      latRaw === null ? null : latRaw !== undefined ? parseNumber(latRaw) : undefined;
    const longitude =
      lonRaw === null ? null : lonRaw !== undefined ? parseNumber(lonRaw) : undefined;
    const radius_meters =
      radRaw === null ? null : radRaw !== undefined ? parseNumber(radRaw) : undefined;

    if (name === undefined && !hasAttendance) {
      res.status(400).json({
        success: false,
        error: "Provide name and/or attendance fields (latitude, longitude, radius_meters)",
      });
      return;
    }

    const result = await branchesService.updateBranch(companyId, branchId, {
      ...(name !== undefined ? { name } : {}),
      ...(hasAttendance
        ? {
            latitude: latitude !== undefined ? latitude : undefined,
            longitude: longitude !== undefined ? longitude : undefined,
            radius_meters: radius_meters !== undefined ? radius_meters : undefined,
          }
        : {}),
    });
    if (result.error) {
      const status = result.error === "Branch not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: result.data });
    await logAction(companyId, req.context!.userId, "branch.update", "branch", branchId, {
      name_updated: name !== undefined,
      attendance_updated: hasAttendance,
    });
  } catch (err) {
    console.error("patchBranch error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function validateBranchQr(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const qr_code = trimString(req.body?.qr_code);
    const latitude = parseNumber(req.body?.latitude);
    const longitude = parseNumber(req.body?.longitude);

    if (!qr_code) {
      res.status(400).json({ success: false, error: "qr_code is required" });
      return;
    }
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, error: "Location permission is required" });
      return;
    }

    const result = await branchesService.validateBranchQr(
      companyId,
      qr_code,
      latitude,
      longitude
    );
    if (result.error) {
      if (isQrAttendanceLocationForbiddenError(result.error)) {
        res.status(403).json({ success: false, error: result.error });
        return;
      }
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("validateBranchQr error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteBranch(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const branchId = routeParamId(req.params.branchId);
    if (!branchId) {
      res.status(400).json({ success: false, error: "branchId is required" });
      return;
    }
    const result = await branchesService.deleteBranch(companyId, branchId);
    if (result.error) {
      const status =
        result.error === "Branch not found" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: null });
    await logAction(companyId, userId, "branch.delete", "branch", branchId);
  } catch (err) {
    console.error("deleteBranch error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
