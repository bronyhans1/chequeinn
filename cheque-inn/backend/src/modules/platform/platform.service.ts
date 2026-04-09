import { supabaseAdmin } from "../../config/supabase";
import { normalizeRoles } from "../../config/roles";
import { isAllowedAccountStatus } from "../../lib/accountStatus";
import * as platformRepo from "./platform.repository";
import * as companyPolicyRepo from "../companyPolicy/companyPolicy.repository";
import * as branchesRepo from "../branches/branches.repository";
import { logAction } from "../audit/audit.service";

export interface ProvisionCompanyInput {
  company_name: string;
  company_code?: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  temporary_password: string;
  branch_limit?: number | null;
}

export interface ProvisionCompanyResult {
  company_id: string;
  company_name: string;
  company_code: string;
  admin_user_id: string;
  admin_email: string;
  temporary_password_set: boolean;
}

export interface PlatformCompanyListItem {
  company_id: string;
  company_name: string;
  company_code: string;
  created_at?: string;
  admin_emails: string[];
  branch_limit: number | null;
  branches_count: number;
  status: "active" | "inactive" | "suspended";
}

export interface PlatformDashboardData {
  totals: {
    companies: number;
    companies_active: number;
    companies_inactive: number;
    branches: number;
    departments: number;
    users_total: number;
    users_active: number;
    users_inactive: number;
  };
  recent_activity: Array<{
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    company_id: string;
    company_name: string | null;
    metadata?: unknown;
  }>;
}

export interface PlatformSupportSettings {
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp_url: string | null;
  updated_at?: string;
}

function trim(s: unknown): string | undefined {
  return typeof s === "string" ? s.trim() || undefined : undefined;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "company";
}

function generateCompanyCode(companyName: string): string {
  const base = slugify(companyName);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export async function provisionCompany(
  input: ProvisionCompanyInput
): Promise<{ data?: ProvisionCompanyResult; error?: string }> {
  const companyName = trim(input.company_name);
  const adminFirstName = trim(input.admin_first_name);
  const adminLastName = trim(input.admin_last_name);
  const adminEmail = trim(input.admin_email);
  const temporaryPassword = input.temporary_password;

  if (!companyName) {
    return { error: "company_name is required" };
  }
  if (!adminFirstName) {
    return { error: "admin_first_name is required" };
  }
  if (!adminLastName) {
    return { error: "admin_last_name is required" };
  }
  if (!adminEmail) {
    return { error: "admin_email is required" };
  }
  if (!temporaryPassword || temporaryPassword.length < 6) {
    return { error: "temporary_password is required and must be at least 6 characters" };
  }

  const companyCode = trim(input.company_code) || generateCompanyCode(companyName);
  const branchLimit =
    input.branch_limit === undefined ? undefined : input.branch_limit;

  const existingCompany = await platformRepo.findCompanyByCode(companyCode);
  if (existingCompany) {
    return { error: "A company with this code already exists" };
  }

  let authUserId: string;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: adminFirstName,
      last_name: adminLastName,
    },
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes("already") || authError.message?.toLowerCase().includes("registered")) {
      return { error: "An account with this email already exists" };
    }
    return { error: authError.message || "Failed to create auth user" };
  }

  if (!authData?.user?.id) {
    return { error: "Auth user creation did not return user id" };
  }

  authUserId = authData.user.id;

  const companyId = crypto.randomUUID();

  try {
    await platformRepo.createCompany({
      id: companyId,
      name: companyName,
      company_code: companyCode,
      ...(branchLimit !== undefined ? { branch_limit: branchLimit } : {}),
    });

    const defaultBranch = await branchesRepo.ensureDefaultBranch(companyId);

    await platformRepo.createAppUser(authUserId, companyId, {
      first_name: adminFirstName,
      last_name: adminLastName,
      email: adminEmail,
      branch_id: defaultBranch.id,
    });

    const adminRoleId = await platformRepo.findRoleIdByName("admin");
    if (!adminRoleId) {
      throw new Error("Role 'admin' not found in roles table");
    }
    await platformRepo.assignRole(authUserId, adminRoleId);

    await companyPolicyRepo.createPolicy(companyId, {});
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    const message = err instanceof Error ? err.message : "Failed to create company or user records";
    return { error: message };
  }

  return {
    data: {
      company_id: companyId,
      company_name: companyName,
      company_code: companyCode,
      admin_user_id: authUserId,
      admin_email: adminEmail,
      temporary_password_set: true,
    },
  };
}

export async function listCompanies(): Promise<{ data?: PlatformCompanyListItem[]; error?: string }> {
  try {
    const companies = await platformRepo.listCompanies();
    const adminEmailsByCompany = await platformRepo.listAdminUserIdsByCompany();
    const branchCompanyIds = await platformRepo.listBranchCompanyIdsByCompanyIds(
      companies.map((c) => c.id)
    );
    const branchesCountByCompany = new Map<string, number>();
    for (const companyId of branchCompanyIds) {
      branchesCountByCompany.set(companyId, (branchesCountByCompany.get(companyId) ?? 0) + 1);
    }

    const items: PlatformCompanyListItem[] = companies.map((c) => {
      const st = (c as { status?: string }).status;
      const status =
        st === "inactive" || st === "suspended" ? st : ("active" as const);
      return {
        company_id: c.id,
        company_name: c.name,
        company_code: c.company_code,
        created_at: (c as { created_at?: string }).created_at,
        admin_emails: adminEmailsByCompany.get(c.id) ?? [],
        branch_limit: (c as { branch_limit?: number | null }).branch_limit ?? null,
        branches_count: branchesCountByCompany.get(c.id) ?? 0,
        status,
      };
    });

    return { data: items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list companies";
    return { error: message };
  }
}

export async function updateCompanyBranchLimit(
  companyId: string,
  branchLimit: number | null,
  actorUserId?: string
): Promise<{ success?: true; error?: string }> {
  return patchCompanyRecord(companyId, { branch_limit: branchLimit }, actorUserId);
}

export async function patchCompanyRecord(
  companyId: string,
  input: {
    branch_limit?: number | null;
    status?: "active" | "inactive" | "suspended";
  },
  actorUserId?: string
): Promise<{ success?: true; error?: string }> {
  try {
    const hasBranchLimit = Object.prototype.hasOwnProperty.call(input, "branch_limit");
    const hasStatus = Object.prototype.hasOwnProperty.call(input, "status");
    if (!hasBranchLimit && !hasStatus) {
      return { error: "Provide branch_limit and/or status" };
    }
    if (hasStatus && !isAllowedAccountStatus(input.status)) {
      return { error: "status must be one of: active, inactive, suspended" };
    }

    const ok = await platformRepo.patchCompanyFields(companyId, {
      ...(hasBranchLimit ? { branch_limit: input.branch_limit ?? null } : {}),
      ...(hasStatus && input.status !== undefined ? { status: input.status } : {}),
    });
    if (!ok) return { error: "Company not found" };

    if (actorUserId) {
      try {
        if (hasBranchLimit) {
          await logAction(companyId, actorUserId, "platform.company_branch_limit_update", "company", companyId, {
            branch_limit: input.branch_limit ?? null,
          });
        }
        if (hasStatus) {
          await logAction(companyId, actorUserId, "platform.company_status_update", "company", companyId, {
            status: input.status,
          });
        }
      } catch (auditErr) {
        console.error("Audit log failed for company patch", auditErr);
      }
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update company";
    return { error: message };
  }
}

export async function getDashboard(): Promise<{ data?: PlatformDashboardData; error?: string }> {
  try {
    const [counts, companies, recent] = await Promise.all([
      platformRepo.getPlatformCounts(),
      platformRepo.listCompanies(),
      platformRepo.listRecentAuditPreview(10),
    ]);

    const companyNameById = new Map(companies.map((c) => [c.id, c.name]));
    return {
      data: {
        totals: {
          ...counts,
          companies_inactive: Math.max(0, counts.companies - counts.companies_active),
          users_inactive: Math.max(0, counts.users_total - counts.users_active),
        },
        recent_activity: recent.map((r) => ({
          ...r,
          company_name: companyNameById.get(r.company_id) ?? null,
        })),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load platform dashboard";
    return { error: message };
  }
}

export async function deleteCompany(
  companyId: string,
  confirmationName: string,
  actorUserId?: string
): Promise<{ success?: true; error?: string }> {
  try {
    const company = await platformRepo.getCompanyById(companyId);
    if (!company) return { error: "Company not found" };
    if (!confirmationName || company.name !== confirmationName.trim()) {
      return { error: "Company name confirmation does not match." };
    }

    // Audit before deletion so we don't rely on deleted company references.
    if (actorUserId) {
      try {
        await logAction(companyId, actorUserId, "platform.company_delete", "company", companyId, {
          company_name: company.name,
        });
      } catch (auditErr) {
        console.error("Audit log failed for company delete", auditErr);
      }
    }

    const userIds = await platformRepo.listUserIdsByCompany(companyId);
    await platformRepo.deleteCompanyCascade(companyId);

    // Best effort: remove auth identities after DB cleanup.
    await Promise.all(
      userIds.map((id) =>
        supabaseAdmin.auth.admin.deleteUser(id).catch(() => undefined)
      )
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete company";
    return { error: message };
  }
}

export async function deleteUserAsPlatformAdmin(
  targetUserId: string,
  actorUserId: string
): Promise<{ success?: true; error?: string }> {
  try {
    if (!targetUserId) return { error: "target_user_id is required" };
    if (targetUserId === actorUserId) {
      return { error: "You cannot delete your own platform account." };
    }
    const target = await platformRepo.getUserById(targetUserId);
    if (!target) return { error: "User not found" };
    const roles = normalizeRoles(await platformRepo.getRoleNamesForUser(targetUserId));
    if (roles.includes("PLATFORM_ADMIN")) {
      return { error: "Platform admin accounts cannot be deleted by this endpoint." };
    }
    await platformRepo.deleteUserData(targetUserId);
    await supabaseAdmin.auth.admin.deleteUser(targetUserId).catch(() => undefined);
    if (target.company_id) {
      await logAction(target.company_id, actorUserId, "platform.user_delete", "user", targetUserId);
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    return { error: message };
  }
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t : null;
}

export async function getSupportSettings(): Promise<{ data?: PlatformSupportSettings; error?: string }> {
  try {
    const data = await platformRepo.getSupportSettings();
    return {
      data: {
        support_email: data?.support_email ?? null,
        support_phone: data?.support_phone ?? null,
        support_whatsapp_url: data?.support_whatsapp_url ?? null,
        updated_at: (data as any)?.updated_at,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load support settings";
    return { error: message };
  }
}

export async function updateSupportSettings(
  input: {
    support_email?: unknown;
    support_phone?: unknown;
    support_whatsapp_url?: unknown;
  },
  _actorUserId?: string
): Promise<{ data?: PlatformSupportSettings; error?: string }> {
  try {
    const patch = {
      support_email: normalizeOptionalString(input.support_email),
      support_phone: normalizeOptionalString(input.support_phone),
      support_whatsapp_url: normalizeOptionalString(input.support_whatsapp_url),
    };

    if (
      patch.support_email === undefined &&
      patch.support_phone === undefined &&
      patch.support_whatsapp_url === undefined
    ) {
      return { error: "No fields provided" };
    }

    const saved = await platformRepo.upsertSupportSettings({
      ...(patch.support_email !== undefined ? { support_email: patch.support_email } : {}),
      ...(patch.support_phone !== undefined ? { support_phone: patch.support_phone } : {}),
      ...(patch.support_whatsapp_url !== undefined ? { support_whatsapp_url: patch.support_whatsapp_url } : {}),
    });

    return { data: saved as any };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update support settings";
    return { error: message };
  }
}
