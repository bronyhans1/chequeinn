import { supabaseAdmin } from "../../config/supabase";

export type UserAccountStatus = "active" | "inactive" | "suspended";

export interface UserRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id: string;
  branch_id: string;
  department_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone_number?: string | null;
  profile_photo_url?: string | null;
  status: UserAccountStatus;
  shift_id?: string | null;
}

export interface CreateUserInput {
  first_name: string;
  last_name: string;
  email: string;
  company_id: string;
  branch_id: string;
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  branch_id?: string;
  department_id?: string | null;
  status?: UserAccountStatus;
}

const USER_ROW_SELECT =
  "id, first_name, last_name, email, company_id, branch_id, department_id, date_of_birth, gender, phone_number, profile_photo_url, status, shift_id";

export async function findActiveUserIdsByBranch(
  companyId: string,
  branchId: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("branch_id", branchId)
    .eq("status", "active");

  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Users in a branch who have at least one **pending** leave request (any status in leave is only pending).
 * Used to widen manager/HR leave queues when an employee is later deactivated.
 */
export async function findUserIdsWithPendingLeaveInBranch(
  companyId: string,
  branchId: string
): Promise<string[]> {
  const { data: pendRows, error: pendErr } = await supabaseAdmin
    .from("leave_requests")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "pending");

  if (pendErr) throw pendErr;
  const pendingUserIds = [
    ...new Set(
      (pendRows ?? [])
        .map((r: { user_id: string }) => r.user_id)
        .filter((id: string) => typeof id === "string" && id.length > 0)
    ),
  ];
  if (pendingUserIds.length === 0) return [];

  const { data: inBranch, error: ubErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("branch_id", branchId)
    .in("id", pendingUserIds);

  if (ubErr) throw ubErr;
  return (inBranch ?? []).map((r: { id: string }) => r.id);
}

export async function findAllByCompanyId(
  companyId: string,
  branchId?: string
): Promise<UserRecord[]> {
  let q = supabaseAdmin
    .from("users")
    .select(USER_ROW_SELECT)
    .eq("company_id", companyId)
    .order("last_name", { ascending: true });

  if (branchId) {
    q = q.eq("branch_id", branchId);
  }

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as UserRecord[];
}

export async function findByEmailAndCompanyId(
  email: string,
  companyId: string
): Promise<UserRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(USER_ROW_SELECT)
    .eq("email", email)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as UserRecord | null;
}

/** Any row with this email (auth + app user must stay 1:1 per email). */
export async function findByEmailAnywhere(
  email: string
): Promise<Pick<UserRecord, "id"> | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data as Pick<UserRecord, "id"> | null;
}

/**
 * Role display names per user_id (batch). Uses user_roles + roles tables.
 */
export async function fetchRoleNamesForUserIds(
  userIds: string[]
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role_id")
    .in("user_id", userIds);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ user_id: string; role_id: string | number }>;
  const roleIds = [...new Set(rows.map((r) => r.role_id).filter((x) => x != null))];
  if (roleIds.length === 0) return new Map();

  const { data: rolesData, error: rolesErr } = await supabaseAdmin
    .from("roles")
    .select("id, name")
    .in("id", roleIds as unknown as string[]);

  if (rolesErr) throw rolesErr;

  const idToName = new Map<string, string>();
  for (const r of (rolesData ?? []) as Array<{ id: string | number; name: string }>) {
    idToName.set(String(r.id), r.name);
  }

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const name = idToName.get(String(row.role_id));
    if (!name) continue;
    const arr = map.get(row.user_id) ?? [];
    arr.push(name);
    map.set(row.user_id, arr);
  }
  return map;
}

export async function findByIdAndCompanyId(
  id: string,
  companyId: string
): Promise<UserRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(USER_ROW_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  return data as UserRecord;
}

export async function create(input: CreateUserInput): Promise<UserRecord> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      company_id: input.company_id,
      branch_id: input.branch_id,
      must_change_password: true,
    })
    .select(USER_ROW_SELECT)
    .single();

  if (error) throw error;
  return data as UserRecord;
}

export async function update(
  id: string,
  companyId: string,
  input: UpdateUserInput
): Promise<UserRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(USER_ROW_SELECT)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as UserRecord;
}

export async function softDelete(id: string, companyId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ status: "inactive" })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") return false;
    throw error;
  }
  return !!data;
}

async function countUserCompanyRows(table: string, userId: string, companyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
  return count ?? 0;
}

async function countAuditLogsAsActor(userId: string, companyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("actor_id", userId);
  if (error) throw error;
  return count ?? 0;
}

async function countAuditLogsAsUserEntity(userId: string, companyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("entity_type", "user")
    .eq("entity_id", userId)
    .neq("action", "user.create");
  if (error) throw error;
  return count ?? 0;
}

/** True when any company-scoped historical row would be orphaned by a hard delete. */
export async function employeeHasDeleteBlockingRecords(userId: string, companyId: string): Promise<boolean> {
  const [
    sessions,
    payroll,
    leaveReq,
    leaveBal,
    overrides,
    syncFailures,
    wageRates,
    auditActor,
    auditUserEntity,
  ] = await Promise.all([
    countUserCompanyRows("work_sessions", userId, companyId),
    countUserCompanyRows("payroll_records", userId, companyId),
    countUserCompanyRows("leave_requests", userId, companyId),
    countUserCompanyRows("leave_balances", userId, companyId),
    countUserCompanyRows("attendance_day_overrides", userId, companyId),
    countUserCompanyRows("payroll_sync_failures", userId, companyId),
    countUserCompanyRows("wage_rates", userId, companyId),
    countAuditLogsAsActor(userId, companyId),
    countAuditLogsAsUserEntity(userId, companyId),
  ]);

  return [
    sessions,
    payroll,
    leaveReq,
    leaveBal,
    overrides,
    syncFailures,
    wageRates,
    auditActor,
    auditUserEntity,
  ].some((n) => n > 0);
}

/** Removes app user row and roles; caller must delete auth user and enforce dependency checks first. */
export async function hardDeleteUserAppRecords(userId: string, companyId: string): Promise<void> {
  const { error: roleErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (roleErr) throw roleErr;
  const { error: userErr } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("company_id", companyId);
  if (userErr) throw userErr;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(USER_ROW_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserRecord | null;
}

export async function assignShiftToUser(
  userId: string,
  companyId: string,
  shiftId: string | null
): Promise<UserRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ shift_id: shiftId })
    .eq("id", userId)
    .eq("company_id", companyId)
    .select(USER_ROW_SELECT)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as UserRecord;
}
