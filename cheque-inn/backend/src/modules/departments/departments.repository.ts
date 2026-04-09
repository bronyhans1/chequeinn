import { supabaseAdmin } from "../../config/supabase";

export interface DepartmentRecord {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  created_at: string;
}

export interface CreateDepartmentInput {
  company_id: string;
  branch_id: string;
  name: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  branch_id?: string;
}

export async function createDepartment(
  input: CreateDepartmentInput
): Promise<DepartmentRecord> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert({
      company_id: input.company_id,
      branch_id: input.branch_id,
      name: input.name,
    })
    .select("id, company_id, branch_id, name, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as DepartmentRecord;
}

export async function findAllByCompanyId(
  companyId: string,
  branchId?: string
): Promise<DepartmentRecord[]> {
  let q = supabaseAdmin
    .from("departments")
    .select("id, company_id, branch_id, name, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (branchId) {
    q = q.eq("branch_id", branchId);
  }

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as DepartmentRecord[];
}

export async function findByIdAndCompanyId(
  id: string,
  companyId: string
): Promise<DepartmentRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("id, company_id, branch_id, name, created_at")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }

  return data as DepartmentRecord;
}

export async function updateDepartment(
  id: string,
  companyId: string,
  input: UpdateDepartmentInput
): Promise<DepartmentRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, company_id, branch_id, name, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }

  return data as DepartmentRecord;
}

export async function deleteDepartment(
  id: string,
  companyId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return false;
    throw error;
  }

  return !!data;
}
