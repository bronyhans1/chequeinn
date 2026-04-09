import { supabaseAdmin } from "../../config/supabase";

export interface PayrollRecord {
  id: string;
  user_id: string;
  company_id: string;
  /** Human-friendly employee display name (resolved from users table when possible). */
  employee_name?: string | null;
  /** Human-friendly employee email (resolved from users table when possible). */
  employee_email?: string | null;
  session_id: string | null;
  regular_minutes: number;
  overtime_minutes: number;
  hours_worked: number;
  hourly_rate: number;
  /** Net gross after late deduction when applicable. */
  gross_earnings: number;
  /** Accrual before late pay deduction; null if not stored / no split. */
  gross_before_late_deduction?: number | null;
  /** Late deduction amount; null if none. */
  late_deduction_amount?: number | null;
  payroll_date: string;
  status?: string;
  created_at?: string;
  record_type?: string;
  earnings_date?: string | null;
}

/** Legacy rows: no columns → base = net, late = 0. */
export function payrollRecordEarningsBreakdown(r: PayrollRecord): {
  net: number;
  baseBeforeLate: number;
  lateDeduction: number;
} {
  const net = typeof r.gross_earnings === "number" ? r.gross_earnings : 0;
  const late =
    typeof r.late_deduction_amount === "number" && r.late_deduction_amount > 0
      ? r.late_deduction_amount
      : 0;
  const hasBase =
    typeof r.gross_before_late_deduction === "number" &&
    !Number.isNaN(r.gross_before_late_deduction);
  const baseBeforeLate = hasBase ? (r.gross_before_late_deduction as number) : net + late;
  return { net, baseBeforeLate, lateDeduction: late };
}

export interface CreatePayrollRecordData {
  user_id: string;
  company_id: string;
  session_id: string;
  regular_minutes: number;
  overtime_minutes: number;
  hours_worked: number;
  hourly_rate: number;
  gross_earnings: number;
  payroll_date: string;
  gross_before_late_deduction?: number | null;
  late_deduction_amount?: number | null;
}

export async function createPayrollRecord(
  data: CreatePayrollRecordData
): Promise<PayrollRecord> {
  const rowPayload: Record<string, unknown> = {
    user_id: data.user_id,
    company_id: data.company_id,
    session_id: data.session_id,
    regular_minutes: data.regular_minutes,
    overtime_minutes: data.overtime_minutes,
    hours_worked: data.hours_worked,
    hourly_rate: data.hourly_rate,
    gross_earnings: data.gross_earnings,
    payroll_date: data.payroll_date,
    record_type: "session_hourly",
    earnings_date: null,
    status: "draft",
  };
  rowPayload.gross_before_late_deduction = data.gross_before_late_deduction ?? null;
  rowPayload.late_deduction_amount = data.late_deduction_amount ?? null;

  const { data: row, error } = await supabaseAdmin
    .from("payroll_records")
    .upsert(rowPayload, { onConflict: "record_type,session_id" })
    .select("*")
    .single();

  if (error) throw error;
  return row as PayrollRecord;
}

export async function getPayrollById(
  payrollId: string
): Promise<PayrollRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("*")
    .eq("id", payrollId)
    .maybeSingle();

  if (error) throw error;
  return data as PayrollRecord | null;
}

export async function getPayrollByIdAndCompany(
  id: string,
  companyId: string
): Promise<PayrollRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as PayrollRecord | null;
}

export async function approvePayrollRecord(
  id: string,
  companyId: string
): Promise<PayrollRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("company_id", companyId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return data as PayrollRecord;
}

export async function lockPayrollRecord(
  id: string,
  companyId: string
): Promise<PayrollRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .update({ status: "locked" })
    .eq("id", id)
    .eq("company_id", companyId)
    .eq("status", "approved")
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return data as PayrollRecord;
}

export async function getPayrollByUser(
  userId: string,
  companyId: string
): Promise<PayrollRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("payroll_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PayrollRecord[];
}

export async function getPayrollByCompany(
  companyId: string
): Promise<PayrollRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("*")
    .eq("company_id", companyId)
    .order("payroll_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PayrollRecord[];
}

export async function companyHasAnyPayrollRecords(companyId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

function getMonthRange(
  year: number,
  month: number
): { monthStart: string; monthEnd: string } {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return {
    monthStart: monthStart.toISOString().slice(0, 10),
    monthEnd: monthEnd.toISOString().slice(0, 10),
  };
}

export async function getPayrollByMonth(
  companyId: string,
  year: number,
  month: number
): Promise<PayrollRecord[]> {
  const { monthStart, monthEnd } = getMonthRange(year, month);

  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("*")
    .eq("company_id", companyId)
    .gte("payroll_date", monthStart)
    .lte("payroll_date", monthEnd)
    .order("payroll_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PayrollRecord[];
}

/**
 * Payroll records for a given month (for export).
 */
export async function getPayrollExportByMonth(
  companyId: string,
  year: number,
  month: number
): Promise<PayrollRecord[]> {
  return getPayrollByMonth(companyId, year, month);
}

export async function deleteSalaryDailyForUserMonth(
  userId: string,
  companyId: string,
  year: number,
  month: number
): Promise<void> {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastD = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastD).padStart(2, "0")}`;
  const { error } = await supabaseAdmin
    .from("payroll_records")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("record_type", "salary_daily")
    .gte("earnings_date", first)
    .lte("earnings_date", last);
  if (error) throw error;
}

/**
 * Monthly accrual row: `earnings_date` is the payable UTC calendar day; `payroll_date` matches it so month filters
 * (`getPayrollByUserMonth`) stay aligned with earnings_date.
 */
export async function insertSalaryDailyRecord(data: {
  user_id: string;
  company_id: string;
  earnings_date: string;
  gross_earnings: number;
  daily_rate: number;
  gross_before_late_deduction?: number | null;
  late_deduction_amount?: number | null;
}): Promise<PayrollRecord> {
  const payload: Record<string, unknown> = {
    user_id: data.user_id,
    company_id: data.company_id,
    session_id: null,
    regular_minutes: 0,
    overtime_minutes: 0,
    hours_worked: 0,
    hourly_rate: data.daily_rate,
    gross_earnings: data.gross_earnings,
    payroll_date: data.earnings_date,
    record_type: "salary_daily",
    earnings_date: data.earnings_date,
    status: "draft",
  };
  payload.gross_before_late_deduction = data.gross_before_late_deduction ?? null;
  payload.late_deduction_amount = data.late_deduction_amount ?? null;

  const { data: row, error } = await supabaseAdmin
    .from("payroll_records")
    .upsert(payload, { onConflict: "record_type,user_id,company_id,earnings_date" })
    .select("*")
    .single();
  if (error) throw error;
  return row as PayrollRecord;
}

/** Payroll rows for user in a calendar month (all types). */
export async function getPayrollByUserMonth(
  userId: string,
  companyId: string,
  year: number,
  month: number
): Promise<PayrollRecord[]> {
  const { monthStart, monthEnd } = (function m(y: number, mo: number) {
    const ms = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
    const me = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
    return {
      monthStart: ms.toISOString().slice(0, 10),
      monthEnd: me.toISOString().slice(0, 10),
    };
  })(year, month);

  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .gte("payroll_date", monthStart)
    .lte("payroll_date", monthEnd)
    .order("payroll_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PayrollRecord[];
}
