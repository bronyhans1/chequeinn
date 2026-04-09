import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { AuthenticatedRequest } from "../../types/auth";
import * as platformService from "./platform.service";

function trim(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return undefined;
    const n = Number(t);
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

export async function provisionCompany(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const body = req.body || {};
    const input: platformService.ProvisionCompanyInput = {
      company_name: trim(body.company_name) ?? "",
      company_code: trim(body.company_code),
      admin_first_name: trim(body.admin_first_name) ?? "",
      admin_last_name: trim(body.admin_last_name) ?? "",
      admin_email: trim(body.admin_email) ?? "",
      temporary_password: body.temporary_password ?? "",
      branch_limit: parseOptionalInt(body.branch_limit),
    };

    const result = await platformService.provisionCompany(input);

    if (result.error) {
      const status =
        result.error.includes("already") || result.error.includes("required")
          ? 400
          : 500;
      res.status(status).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("provisionCompany error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function patchCompany(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const companyId = trim(req.params.companyId);
    if (!companyId) {
      res.status(400).json({ success: false, error: "companyId is required" });
      return;
    }

    const body = req.body ?? {};
    const hasBranchLimit = Object.prototype.hasOwnProperty.call(body, "branch_limit");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

    if (!hasBranchLimit && !hasStatus) {
      res.status(400).json({ success: false, error: "Provide branch_limit and/or status" });
      return;
    }

    let branch_limit: number | null | undefined = undefined;
    if (hasBranchLimit) {
      const branchLimit = parseOptionalInt(body.branch_limit);
      if (branchLimit === undefined) {
        res.status(400).json({ success: false, error: "branch_limit must be a whole number, null, or omitted" });
        return;
      }
      if (branchLimit !== null && branchLimit < 0) {
        res.status(400).json({ success: false, error: "branch_limit must be >= 0 or null" });
        return;
      }
      branch_limit = branchLimit;
    }

    let status: "active" | "inactive" | "suspended" | undefined = undefined;
    if (hasStatus) {
      const raw = trim(body.status);
      if (raw !== "active" && raw !== "inactive" && raw !== "suspended") {
        res.status(400).json({ success: false, error: "status must be one of: active, inactive, suspended" });
        return;
      }
      status = raw;
    }

    const result = await platformService.patchCompanyRecord(
      companyId,
      {
        ...(hasBranchLimit ? { branch_limit } : {}),
        ...(hasStatus ? { status } : {}),
      },
      req.context?.userId
    );
    if (result.error) {
      const statusCode = result.error === "Company not found" ? 404 : 500;
      res.status(statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(200).json({ success: true, data: null });
  } catch (err) {
    console.error("patchCompany error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function listCompanies(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const result = await platformService.listCompanies();
    if (result.error) {
      res.status(500).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: result.data ?? [] });
  } catch (err) {
    console.error("listCompanies error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getDashboard(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const result = await platformService.getDashboard();
    if (result.error) {
      res.status(500).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    console.error("getDashboard error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteCompany(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const companyId = trim(req.params.companyId);
    const confirmation = trim(req.body?.confirm_company_name) ?? "";
    if (!companyId) {
      res.status(400).json({ success: false, error: "companyId is required" });
      return;
    }
    const result = await platformService.deleteCompany(companyId, confirmation, req.context!.userId);
    if (result.error) {
      const status =
        result.error === "Company not found"
          ? 404
          : result.error.includes("confirmation")
            ? 400
            : 500;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    console.error("deleteCompany error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteUser(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const targetUserId = trim(req.params.userId);
    if (!targetUserId) {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }
    const result = await platformService.deleteUserAsPlatformAdmin(
      targetUserId,
      req.context!.userId
    );
    if (result.error) {
      const status =
        result.error === "User not found"
          ? 404
          : result.error.includes("cannot be deleted") || result.error.includes("cannot delete")
            ? 403
            : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    console.error("deleteUser (platform) error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getSupportSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await platformService.getSupportSettings();
    if (result.error) {
      res.status(500).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    console.error("getSupportSettings error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function patchSupportSettings(req: ContextRequest, res: Response): Promise<void> {
  try {
    const result = await platformService.updateSupportSettings(req.body ?? {}, req.context?.userId);
    if (result.error) {
      const status = result.error === "No fields provided" ? 400 : 500;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    console.error("patchSupportSettings error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
