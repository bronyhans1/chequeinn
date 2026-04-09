import { supabaseAdmin } from "../../config/supabase";

export interface LeaveRequestRecord {
  id: string;
  user_id: string;
  company_id: string;
  /** Human-friendly employee display name (resolved from users table when possible). */
  employee_name?: string | null;
  /** Human-friendly employee email (resolved from users table when possible). */
  employee_email?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface LeaveBalanceRecord {
  id: string;
  user_id: string;
  company_id: string;
  total_days: number;
  used_days: number;
  updated_at: string;
}

export interface CreateLeaveRequestData {
  user_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason?: string | null;
  total_days: number;
  /** DB chk_leave_requests_status: pending | approved | rejected (lowercase). */
  status: "pending" | "approved" | "rejected";
}

export async function createLeaveRequest(
  data: CreateLeaveRequestData
): Promise<LeaveRequestRecord> {
  const { data: row, error } = await supabaseAdmin
    .from("leave_requests")
    .insert({
      user_id: data.user_id,
      company_id: data.company_id,
      start_date: data.start_date,
      end_date: data.end_date,
      leave_type: data.leave_type,
      reason: data.reason ?? null,
      total_days: data.total_days,
      status: data.status,
    })
    .select("*")
    .single();

  if (error) throw error;
  return row as LeaveRequestRecord;
}

export async function getUserLeaveRequests(
  userId: string
): Promise<LeaveRequestRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  const requests = (data ?? []) as LeaveRequestRecord[];
  return enrichLeaveEmployees(requests);
}

export async function getCompanyLeaveRequests(
  companyId: string,
  statusFilter?: string | null,
  /** When set, only requests for these user ids (manager/HR branch scope). */
  filterUserIds?: string[] | null
): Promise<LeaveRequestRecord[]> {
  let q = supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("company_id", companyId);

  if (filterUserIds !== undefined && filterUserIds !== null) {
    if (filterUserIds.length === 0) {
      return [];
    }
    q = q.in("user_id", filterUserIds);
  }

  const normalized = statusFilter?.trim().toLowerCase();
  if (
    normalized &&
    (normalized === "pending" ||
      normalized === "approved" ||
      normalized === "rejected")
  ) {
    q = q.eq("status", normalized);
  }

  const { data, error } = await q.order("start_date", { ascending: false });

  if (error) throw error;
  const requests = (data ?? []) as LeaveRequestRecord[];
  return enrichLeaveEmployees(requests);
}

/**
 * Leave rows overlapping [rangeStart, rangeEnd] (inclusive YYYY-MM-DD).
 * Overlap: leave.start_date <= rangeEnd AND leave.end_date >= rangeStart.
 */
export async function listLeaveRequestsForReport(
  companyId: string,
  params: {
    rangeStart: string;
    rangeEnd: string;
    status?: string | null;
    userId?: string | null;
    filterUserIds?: string[] | null;
  },
  offset: number,
  limit: number
): Promise<{ rows: LeaveRequestRecord[]; total: number }> {
  if (
    params.filterUserIds !== undefined &&
    params.filterUserIds !== null &&
    params.filterUserIds.length === 0
  ) {
    return { rows: [], total: 0 };
  }

  let q = supabaseAdmin
    .from("leave_requests")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .lte("start_date", params.rangeEnd)
    .gte("end_date", params.rangeStart)
    .order("start_date", { ascending: false });

  if (params.filterUserIds !== undefined && params.filterUserIds !== null) {
    q = q.in("user_id", params.filterUserIds);
  }
  if (params.userId?.trim()) {
    q = q.eq("user_id", params.userId.trim());
  }
  const normalized = params.status?.trim().toLowerCase();
  if (
    normalized &&
    (normalized === "pending" ||
      normalized === "approved" ||
      normalized === "rejected")
  ) {
    q = q.eq("status", normalized);
  }

  const { data, error, count } = await q.range(
    offset,
    offset + limit - 1
  );

  if (error) throw error;
  const raw = (data ?? []) as LeaveRequestRecord[];
  const rows = await enrichLeaveEmployees(raw);
  return { rows, total: count ?? 0 };
}

export async function getLeaveById(
  leaveId: string
): Promise<LeaveRequestRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("id", leaveId)
    .maybeSingle();

  if (error) throw error;
  return data as LeaveRequestRecord | null;
}

export async function updateLeaveStatus(
  leaveId: string,
  status: string,
  approvedBy: string | null,
  approvedAt: string | null
): Promise<LeaveRequestRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .update({
      status,
      approved_by: approvedBy,
      approved_at: approvedAt,
    })
    .eq("id", leaveId)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return data as LeaveRequestRecord;
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

async function enrichLeaveEmployees(
  requests: LeaveRequestRecord[]
): Promise<LeaveRequestRecord[]> {
  if (requests.length === 0) return requests;

  const userIds = Array.from(
    new Set(requests.map((r) => r.user_id).filter((id) => typeof id === "string" && id.length > 0))
  );

  if (userIds.length === 0) {
    return requests.map((r) => ({ ...r, employee_name: null, employee_email: null }));
  }

  // Safe fallback: if lookup fails, keep the endpoint working with existing user_id.
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    if (error) {
      console.error("enrichLeaveEmployees users lookup error", error);
      return requests.map((r) => ({ ...r, employee_name: null, employee_email: null }));
    }

    const userById = new Map<
      string,
      { name: string; email: string | null }
    >(
      (users ?? []).map((u: any) => [
        u.id as string,
        {
          name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
          email: u.email ?? null,
        },
      ])
    );

    return requests.map((r) => {
      const resolved = userById.get(r.user_id);
      return {
        ...r,
        employee_name: resolved?.name ?? null,
        employee_email: resolved?.email ?? null,
      };
    });
  } catch (err) {
    console.error("enrichLeaveEmployees exception", err);
    return requests.map((r) => ({ ...r, employee_name: null, employee_email: null }));
  }
}

export async function updateLeaveBalance(
  userId: string,
  companyId: string,
  daysToAdd: number
): Promise<void> {
  const balance = await getLeaveBalance(userId, companyId);
  if (!balance) throw new Error("Leave balance record not found");

  const { error } = await supabaseAdmin
    .from("leave_balances")
    .update({ used_days: balance.used_days + daysToAdd })
    .eq("user_id", userId)
    .eq("company_id", companyId);

  if (error) throw error;
}

/** One transaction: validate balance, increment used_days, set leave approved. */
export async function approveLeaveRequestTransaction(
  leaveId: string,
  companyId: string,
  approverId: string
): Promise<LeaveRequestRecord> {
  const { data, error } = await supabaseAdmin.rpc("approve_leave_request_tx", {
    p_leave_id: leaveId,
    p_company_id: companyId,
    p_approver_id: approverId,
  });

  if (error) {
    const raw =
      (error as { message?: string }).message ??
      (typeof error === "string" ? error : JSON.stringify(error));
    const e = new Error(raw) as Error & { code?: string };
    e.code = mapRpcExceptionCode(raw);
    throw e;
  }

  if (!data) {
    throw Object.assign(new Error("approve_leave_request_tx returned no data"), { code: "empty" });
  }

  const row = (Array.isArray(data) ? data[0] : data) as LeaveRequestRecord;
  return row;
}

function mapRpcExceptionCode(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("leave_not_found")) return "leave_not_found";
  if (m.includes("leave_not_pending")) return "leave_not_pending";
  if (m.includes("leave_balance_missing")) return "leave_balance_missing";
  if (m.includes("leave_balance_insufficient")) return "leave_balance_insufficient";
  return "unknown";
}

/**
 * Returns approved leave_requests where today is between start_date and end_date (inclusive).
 * todayDate: "YYYY-MM-DD" (defaults to current date if not provided).
 */
export async function getApprovedLeavesForToday(
  companyId: string,
  todayDate?: string
): Promise<LeaveRequestRecord[]> {
  const today = todayDate ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", today);

  if (error) throw error;
  return (data ?? []) as LeaveRequestRecord[];
}

/**
 * Approved leave_requests overlapping [startDate, endDate] (inclusive).
 * Use to exclude (user_id, date) from absence when date is within an approved leave.
 */
export async function getApprovedLeavesInRange(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<LeaveRequestRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (error) throw error;
  return (data ?? []) as LeaveRequestRecord[];
}
