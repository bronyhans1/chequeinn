import { supabaseAdmin } from "../../config/supabase";

/** Assumption: companies table has id, name, company_code (unique). */
export interface CompanyRecord {
  id: string;
  name: string;
  company_code: string;
  branch_limit?: number | null;
  created_at?: string;
}

export interface PlatformSupportSettings {
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp_url: string | null;
  updated_at?: string;
}

export interface CreateCompanyInput {
  id: string;
  name: string;
  company_code: string;
  branch_limit?: number | null;
}

export async function findCompanyByCode(companyCode: string): Promise<CompanyRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, company_code")
    .eq("company_code", companyCode)
    .maybeSingle();

  if (error) throw error;
  return data as CompanyRecord | null;
}

export async function createCompany(input: CreateCompanyInput): Promise<CompanyRecord> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert({
      id: input.id,
      name: input.name,
      company_code: input.company_code,
      ...(input.branch_limit !== undefined ? { branch_limit: input.branch_limit } : {}),
    })
    .select("id, name, company_code, branch_limit")
    .single();

  if (error) throw error;
  return data as CompanyRecord;
}

export interface CompanyListItem {
  id: string;
  name: string;
  company_code: string;
  branch_limit?: number | null;
  created_at?: string;
  status?: string;
}

export async function getPlatformCounts(): Promise<{
  companies: number;
  companies_active: number;
  branches: number;
  departments: number;
  users_total: number;
  users_active: number;
}> {
  const [
    companiesRes,
    companiesActiveRes,
    branchesRes,
    departmentsRes,
    usersTotalRes,
    usersActiveRes,
  ] = await Promise.all([
    supabaseAdmin.from("companies").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("branches").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("departments").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (companiesRes.error) throw companiesRes.error;
  if (companiesActiveRes.error) throw companiesActiveRes.error;
  if (branchesRes.error) throw branchesRes.error;
  if (departmentsRes.error) throw departmentsRes.error;
  if (usersTotalRes.error) throw usersTotalRes.error;
  if (usersActiveRes.error) throw usersActiveRes.error;

  return {
    companies: companiesRes.count ?? 0,
    companies_active: companiesActiveRes.count ?? 0,
    branches: branchesRes.count ?? 0,
    departments: departmentsRes.count ?? 0,
    users_total: usersTotalRes.count ?? 0,
    users_active: usersActiveRes.count ?? 0,
  };
}

export async function getSupportSettings(): Promise<PlatformSupportSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("support_email, support_phone, support_whatsapp_url, updated_at")
    .eq("id", "global")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PlatformSupportSettings | null;
}

export async function upsertSupportSettings(input: {
  support_email?: string | null;
  support_phone?: string | null;
  support_whatsapp_url?: string | null;
}): Promise<PlatformSupportSettings> {
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .upsert(
      {
        id: "global",
        ...(input.support_email !== undefined ? { support_email: input.support_email } : {}),
        ...(input.support_phone !== undefined ? { support_phone: input.support_phone } : {}),
        ...(input.support_whatsapp_url !== undefined ? { support_whatsapp_url: input.support_whatsapp_url } : {}),
      },
      { onConflict: "id" }
    )
    .select("support_email, support_phone, support_whatsapp_url, updated_at")
    .single();
  if (error) throw error;
  return data as PlatformSupportSettings;
}

export interface PlatformAuditPreview {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  company_id: string;
  metadata?: unknown;
}

export async function listRecentAuditPreview(limit: number): Promise<PlatformAuditPreview[]> {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, company_id, metadata")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PlatformAuditPreview[];
}

export async function listCompanies(): Promise<CompanyListItem[]> {
  // Prefer including created_at when present; fall back safely if schema lacks it.
  try {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, company_code, branch_limit, created_at, status")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CompanyListItem[];
  } catch {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, company_code, branch_limit, status")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CompanyListItem[];
  }
}

export async function updateCompanyBranchLimit(
  companyId: string,
  branchLimit: number | null
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .update({ branch_limit: branchLimit })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function patchCompanyFields(
  companyId: string,
  patch: { branch_limit?: number | null; status?: string }
): Promise<boolean> {
  const updates: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(patch, "branch_limit")) {
    updates.branch_limit = patch.branch_limit;
  }
  if (patch.status !== undefined) {
    updates.status = patch.status;
  }
  if (Object.keys(updates).length === 0) return false;

  const { data, error } = await supabaseAdmin
    .from("companies")
    .update(updates)
    .eq("id", companyId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function listBranchCompanyIdsByCompanyIds(companyIds: string[]): Promise<string[]> {
  const unique = [...new Set(companyIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("company_id")
    .in("company_id", unique);

  if (error) throw error;
  return (data ?? [])
    .map((r: { company_id?: string | null }) => r.company_id)
    .filter(Boolean) as string[];
}

/** Assumption: roles table has id, name. */
export async function findRoleIdByName(roleName: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

/** Assumption: user_roles table has user_id, role_id. */
export async function assignRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("user_roles").insert({
    user_id: userId,
    role_id: roleId,
  });

  if (error) throw error;
}

export async function listAdminUserIdsByCompany(): Promise<Map<string, string[]>> {
  const adminRoleId = await findRoleIdByName("admin");
  if (!adminRoleId) {
    throw new Error("Role 'admin' not found in roles table");
  }

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role_id", adminRoleId);

  if (error) throw error;
  const userIds = (data ?? [])
    .map((r: any) => r.user_id as string)
    .filter(Boolean);

  if (userIds.length === 0) return new Map();

  const { data: users, error: usersErr } = await supabaseAdmin
    .from("users")
    .select("id, email, company_id")
    .in("id", userIds);

  if (usersErr) throw usersErr;

  const out = new Map<string, string[]>();
  for (const u of (users ?? []) as any[]) {
    const companyId = u.company_id as string | null | undefined;
    if (!companyId) continue;
    const email = (u.email as string | null | undefined) ?? "";
    if (!email) continue;
    const arr = out.get(companyId) ?? [];
    arr.push(email);
    out.set(companyId, arr);
  }
  return out;
}

/** Create app users row with explicit id (auth user id). Requires branch_id (Phase 1). */
export async function createAppUser(
  id: string,
  companyId: string,
  input: { first_name: string; last_name: string; email: string; branch_id: string }
): Promise<void> {
  const { error } = await supabaseAdmin.from("users").insert({
    id,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    company_id: companyId,
    branch_id: input.branch_id,
    must_change_password: true,
  });

  if (error) throw error;
}

export async function getCompanyById(companyId: string): Promise<CompanyListItem | null> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, company_code, branch_limit, created_at, status")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CompanyListItem | null;
}

export async function listUserIdsByCompany(companyId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function deleteCompanyCascade(companyId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("platform_delete_company", {
    target_company_id: companyId,
  });
  if (error) throw error;
}

export async function getUserById(userId: string): Promise<{ id: string; company_id: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as { id: string; company_id: string | null } | null;
}

export async function getRoleNamesForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (
    data?.map((r) => {
      const role = (r as { roles?: { name?: string } | Array<{ name?: string }> }).roles;
      if (Array.isArray(role)) return role[0]?.name;
      return role?.name;
    }).filter(Boolean) ?? []
  ) as string[];
}

export async function deleteUserData(userId: string): Promise<void> {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("users").delete().eq("id", userId);
}
