import { supabaseAdmin } from "../../config/supabase";

const BRANCH_SELECT_FULL =
  "id, company_id, name, is_default, created_at, qr_code, latitude, longitude, radius_meters";

export async function getCompanyBranchLimit(companyId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("branch_limit")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  const raw = (data as { branch_limit?: unknown } | null)?.branch_limit;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export interface BranchRecord {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  created_at?: string;
  qr_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

async function assignBranchQrIfNeeded(row: BranchRecord): Promise<BranchRecord> {
  if (row.qr_code && String(row.qr_code).trim()) {
    return row;
  }
  const qrValue = `branch:${row.id}`;
  const { data, error } = await supabaseAdmin
    .from("branches")
    .update({ qr_code: qrValue })
    .eq("id", row.id)
    .eq("company_id", row.company_id)
    .select(BRANCH_SELECT_FULL)
    .single();

  if (error) throw error;
  return data as BranchRecord;
}

export async function listByCompanyId(companyId: string): Promise<BranchRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select(BRANCH_SELECT_FULL)
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BranchRecord[];
}

export async function findDefaultByCompanyId(
  companyId: string
): Promise<BranchRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select(BRANCH_SELECT_FULL)
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as BranchRecord | null;
}

/** Ensures exactly one default branch exists for the company (runtime safety after provisioning). */
export async function ensureDefaultBranch(companyId: string): Promise<BranchRecord> {
  const existing = await findDefaultByCompanyId(companyId);
  if (existing) {
    return assignBranchQrIfNeeded(existing);
  }

  const { data, error } = await supabaseAdmin
    .from("branches")
    .insert({
      company_id: companyId,
      name: "Main",
      is_default: true,
    })
    .select(BRANCH_SELECT_FULL)
    .single();

  if (error) throw error;
  return assignBranchQrIfNeeded(data as BranchRecord);
}

export async function insertBranch(
  companyId: string,
  name: string,
  isDefault: boolean
): Promise<BranchRecord> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .insert({
      company_id: companyId,
      name,
      is_default: isDefault,
    })
    .select(BRANCH_SELECT_FULL)
    .single();

  if (error) throw error;
  return assignBranchQrIfNeeded(data as BranchRecord);
}

export async function updateBranchName(
  branchId: string,
  companyId: string,
  name: string
): Promise<BranchRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .update({ name })
    .eq("id", branchId)
    .eq("company_id", companyId)
    .select(BRANCH_SELECT_FULL)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as BranchRecord | null;
}

export interface UpdateBranchAttendanceInput {
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

export async function updateBranchAttendance(
  branchId: string,
  companyId: string,
  input: UpdateBranchAttendanceInput
): Promise<BranchRecord | null> {
  const payload: Record<string, unknown> = {};
  if (input.latitude !== undefined) payload.latitude = input.latitude;
  if (input.longitude !== undefined) payload.longitude = input.longitude;
  if (input.radius_meters !== undefined) payload.radius_meters = input.radius_meters;
  if (Object.keys(payload).length === 0) {
    return findById(branchId);
  }

  const { data, error } = await supabaseAdmin
    .from("branches")
    .update(payload)
    .eq("id", branchId)
    .eq("company_id", companyId)
    .select(BRANCH_SELECT_FULL)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as BranchRecord | null;
}

export async function deleteBranchRow(branchId: string, companyId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .delete()
    .eq("id", branchId)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function countUsersForBranch(branchId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId);

  if (error) throw error;
  return count ?? 0;
}

export async function countDepartmentsForBranch(branchId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("departments")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId);

  if (error) throw error;
  return count ?? 0;
}

export async function findByIds(ids: string[]): Promise<Map<string, BranchRecord>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, BranchRecord>();
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("branches")
    .select(BRANCH_SELECT_FULL)
    .in("id", unique);

  if (error) throw error;
  for (const row of (data ?? []) as BranchRecord[]) {
    map.set(row.id, row);
  }
  return map;
}

export async function findById(branchId: string): Promise<BranchRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select(BRANCH_SELECT_FULL)
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as BranchRecord | null;
}

export async function findByQrCode(
  qrCode: string,
  companyId: string
): Promise<BranchRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select(BRANCH_SELECT_FULL)
    .eq("qr_code", qrCode)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as BranchRecord | null;
}
