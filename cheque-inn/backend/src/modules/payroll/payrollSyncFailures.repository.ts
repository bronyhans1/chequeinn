import { supabaseAdmin } from "../../config/supabase";

export type PayrollSyncFailureKind = "session_payroll" | "salary_month_sync";

export interface PayrollSyncFailureRow {
  id: string;
  company_id: string;
  user_id: string;
  work_session_id: string | null;
  failure_kind: PayrollSyncFailureKind;
  error_message: string;
  created_at: string;
}

export async function insertPayrollSyncFailure(input: {
  company_id: string;
  user_id: string;
  work_session_id: string | null;
  failure_kind: PayrollSyncFailureKind;
  error_message: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("payroll_sync_failures").insert({
    company_id: input.company_id,
    user_id: input.user_id,
    work_session_id: input.work_session_id,
    failure_kind: input.failure_kind,
    error_message: input.error_message.slice(0, 4000),
  });
  if (error) throw error;
}

export async function listRecentForCompany(
  companyId: string,
  limit: number
): Promise<PayrollSyncFailureRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await supabaseAdmin
    .from("payroll_sync_failures")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data ?? []) as PayrollSyncFailureRow[];
}
