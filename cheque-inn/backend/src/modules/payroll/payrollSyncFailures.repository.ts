import { supabaseAdmin } from "../../config/supabase";
import { logOperationalEvent } from "../../middleware/requestLog.middleware";
import { notifyPayrollSyncFailure } from "../notifications/operationalNotifications.service";

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
  logOperationalEvent("payroll_sync", "payroll_sync_failure_recorded", {
    kind: input.failure_kind,
    user_id: input.user_id.slice(0, 8),
    company_id: input.company_id.slice(0, 8),
  });
  notifyPayrollSyncFailure({
    companyId: input.company_id,
    userId: input.user_id,
    failureKind: input.failure_kind,
    errorMessage: input.error_message,
    workSessionId: input.work_session_id,
  }).catch((err) => console.warn("notifyPayrollSyncFailure", err));
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
