import { supabaseAdmin } from "../../config/supabase";

export interface LeaveBalanceRecord {
  id: string;
  user_id: string;
  company_id: string;
  total_days: number;
  used_days: number;
  updated_at: string;
}

export interface CreateLeaveBalanceData {
  user_id: string;
  company_id: string;
  total_days: number;
  used_days: number;
}

export interface UpdateLeaveBalanceData {
  total_days?: number;
  used_days?: number;
}

export async function getLeaveBalance(
  userId: string,
  companyId: string
): Promise<LeaveBalanceRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as LeaveBalanceRecord | null;
}

export async function createLeaveBalance(
  data: CreateLeaveBalanceData
): Promise<LeaveBalanceRecord> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabaseAdmin
    .from("leave_balances")
    .insert({
      user_id: data.user_id,
      company_id: data.company_id,
      total_days: data.total_days,
      used_days: data.used_days,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return row as LeaveBalanceRecord;
}

export async function getLeaveBalanceById(
  id: string,
  companyId: string
): Promise<LeaveBalanceRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as LeaveBalanceRecord | null;
}

export async function updateLeaveBalanceById(
  id: string,
  companyId: string,
  data: UpdateLeaveBalanceData
): Promise<LeaveBalanceRecord | null> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.total_days !== undefined) updates.total_days = data.total_days;
  if (data.used_days !== undefined) updates.used_days = data.used_days;

  if (Object.keys(updates).length === 1) {
    return getLeaveBalanceById(id, companyId);
  }

  const { data: row, error } = await supabaseAdmin
    .from("leave_balances")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return row as LeaveBalanceRecord;
}

export async function getCompanyLeaveBalances(
  companyId: string,
  filterUserIds?: string[] | null
): Promise<LeaveBalanceRecord[]> {
  let q = supabaseAdmin
    .from("leave_balances")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (filterUserIds !== undefined && filterUserIds !== null) {
    if (filterUserIds.length === 0) {
      return [];
    }
    q = q.in("user_id", filterUserIds);
  }

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as LeaveBalanceRecord[];
}
