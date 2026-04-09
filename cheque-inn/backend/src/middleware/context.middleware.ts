import { Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { normalizeRoles } from "../config/roles";
import { AuthenticatedRequest } from "../types/auth";
import { evaluateAccessForRequester, normalizeAccountStatus } from "../lib/accountStatus";
import { roleNamesFromUserRolesJoin } from "../lib/supabaseRoleJoin";

export interface RequestContext {
  userId: string;
  companyId: string | null;
  /** Set for company users (Phase 1+); used for manager/HR branch scoping. */
  branchId: string | null;
  roles: string[];
}

export interface ContextRequest extends AuthenticatedRequest {
  context?: RequestContext;
}

export const contextMiddleware = async (
  req: ContextRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch roles (user may have multiple)
    const { data: rolesData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", req.user.id);

    if (roleError || !rolesData || rolesData.length === 0) {
      return res.status(403).json({ error: "User roles not assigned" });
    }

    const rawRoles = roleNamesFromUserRolesJoin(rolesData);
    const roles = normalizeRoles(rawRoles);

    const isPlatformAdmin = roles.includes("PLATFORM_ADMIN");

    // Fetch user record (company-scoped users require this; platform users may not have a company_id)
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, company_id, branch_id, status")
      .eq("id", req.user.id)
      .maybeSingle();

    if (userError) {
      if (!isPlatformAdmin) {
        return res.status(500).json({ error: "Failed to build request context" });
      }
      req.context = { userId: req.user.id, companyId: null, branchId: null, roles };
      next();
      return;
    }

    if (!user) {
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: "User not found in system" });
      }
      // PLATFORM_ADMIN can exist without a company-scoped users row.
      req.context = {
        userId: req.user.id,
        companyId: null,
        branchId: null,
        roles,
      };
      next();
      return;
    }

    if (!isPlatformAdmin && !user.company_id) {
      return res.status(403).json({ error: "User has no company assigned" });
    }

    const u = user as {
      id: string;
      company_id: string | null;
      branch_id?: string | null;
      status?: string | null;
    };

    /**
     * Any requester with an app `users` row (including PLATFORM_ADMIN) must pass
     * the same user + company status checks. Pure platform accounts have no `users` row (handled above).
     */
    let companyStatus = null as ReturnType<typeof normalizeAccountStatus> | null;
    if (u.company_id) {
      const { data: comp } = await supabaseAdmin
        .from("companies")
        .select("status")
        .eq("id", u.company_id)
        .maybeSingle();
      companyStatus = normalizeAccountStatus((comp as { status?: string } | null)?.status);
    }
    const ev = evaluateAccessForRequester({
      roles,
      userRow: {
        status: normalizeAccountStatus(u.status),
        company_id: u.company_id ?? null,
      },
      companyStatus,
    });
    if (!ev.allowed) {
      return res.status(403).json({ error: ev.block.message, code: ev.block.code });
    }

    req.context = {
      userId: u.id,
      companyId: u.company_id ?? null,
      branchId: typeof u.branch_id === "string" ? u.branch_id : null,
      roles,
    };

    next();
  } catch (err) {
    console.error("contextMiddleware error", err);
    return res.status(500).json({
      error: "Failed to build request context",
    });
  }
};