import { supabaseAdmin } from "../../config/supabase";
import { WorkSessionStatus } from "../../constants/workSessionStatus";

export interface WorkSessionRecord {
  id: string;
  company_id: string;
  user_id: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  duration_minutes: number | null;
  late_minutes: number | null;
  shift_overtime_minutes?: number | null;
  early_leave_minutes?: number | null;
  half_day?: boolean | null;
  status: string;
  created_at: string;
  department_id?: string | null;
  /** Physical attendance site; prefer explicit over deriving from department_id. */
  branch_id?: string | null;
  shift_id?: string | null;
  manual_check_in?: boolean | null;
  manual_check_in_reason?: string | null;
  manual_check_in_note?: string | null;
  manual_check_in_by?: string | null;
  manual_check_out?: boolean | null;
  manual_check_out_reason?: string | null;
  manual_check_out_note?: string | null;
  manual_check_out_by?: string | null;
}

export interface CreateSessionInput {
  company_id: string;
  user_id: string;
  check_in: string;
  status: string;
  department_id?: string;
  branch_id?: string;
  shift_id?: string;
  late_minutes?: number;
  manual_check_in?: boolean;
  manual_check_in_reason?: string | null;
  manual_check_in_note?: string | null;
  manual_check_in_by?: string | null;
}

export interface CloseSessionInput {
  check_out: string;
  total_hours: number;
  status: string;
  duration_minutes?: number;
  shift_overtime_minutes?: number;
  early_leave_minutes?: number;
  half_day?: boolean;
  manual_check_out?: boolean;
  manual_check_out_reason?: string | null;
  manual_check_out_note?: string | null;
  manual_check_out_by?: string | null;
}

export async function findActiveSession(
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", WorkSessionStatus.ACTIVE)
    .is("check_out", null)
    .maybeSingle();

  if (error) throw error;

  return !!data;
}

export async function findOpenSessionByUser(
  userId: string,
  companyId: string
): Promise<WorkSessionRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("check_out", null)
    .maybeSingle();

  if (error) throw error;
  return data as WorkSessionRecord | null;
}

export async function createSession(
  input: CreateSessionInput
): Promise<WorkSessionRecord> {
  const payload: Record<string, unknown> = {
    company_id: input.company_id,
    user_id: input.user_id,
    check_in: input.check_in,
    status: input.status,
  };

  if (input.department_id) {
    payload.department_id = input.department_id;
  }
  if (input.branch_id) {
    payload.branch_id = input.branch_id;
  }
  if (input.shift_id) {
    payload.shift_id = input.shift_id;
  }
  if (typeof input.late_minutes === "number") {
    payload.late_minutes = input.late_minutes;
  }
  if (input.manual_check_in) {
    payload.manual_check_in = true;
    payload.manual_check_in_reason = input.manual_check_in_reason ?? null;
    payload.manual_check_in_note = input.manual_check_in_note ?? null;
    payload.manual_check_in_by = input.manual_check_in_by ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as WorkSessionRecord;
}

export async function closeSession(
  sessionId: string,
  companyId: string,
  updates: CloseSessionInput
): Promise<WorkSessionRecord | null> {
  const payload: Record<string, unknown> = {
    check_out: updates.check_out,
    total_hours: updates.total_hours,
    status: updates.status,
  };
  if (updates.duration_minutes !== undefined) payload.duration_minutes = updates.duration_minutes;
  if (updates.shift_overtime_minutes !== undefined) payload.shift_overtime_minutes = updates.shift_overtime_minutes;
  if (updates.early_leave_minutes !== undefined) payload.early_leave_minutes = updates.early_leave_minutes;
  if (updates.half_day !== undefined) payload.half_day = updates.half_day;
  if (updates.manual_check_out) {
    payload.manual_check_out = true;
    payload.manual_check_out_reason = updates.manual_check_out_reason ?? null;
    payload.manual_check_out_note = updates.manual_check_out_note ?? null;
    payload.manual_check_out_by = updates.manual_check_out_by ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .update(payload)
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    if ((error as any).code === "PGRST116") return null;
    throw error;
  }

  return data as WorkSessionRecord;
}

export async function getSessionsForUserToday(
  userId: string,
  companyId: string,
  startIso: string,
  endIso: string
): Promise<WorkSessionRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .gte("check_in", startIso)
    .lt("check_in", endIso)
    .order("check_in", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkSessionRecord[];
}

export async function getCompanySessionsToday(
  companyId: string,
  startIso: string,
  endIso: string,
  /** Manager/HR: restrict to these users; `undefined` = whole company. */
  scopedUserIds?: string[] | null
): Promise<WorkSessionRecord[]> {
  if (scopedUserIds !== undefined && scopedUserIds !== null && scopedUserIds.length === 0) {
    return [];
  }

  let q = supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("company_id", companyId)
    .gte("check_in", startIso)
    .lt("check_in", endIso)
    .order("check_in", { ascending: true });

  if (scopedUserIds !== undefined && scopedUserIds !== null) {
    q = q.in("user_id", scopedUserIds);
  }

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as WorkSessionRecord[];
}

export async function getSessionById(
  sessionId: string
): Promise<WorkSessionRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as WorkSessionRecord | null;
}

export interface ListSessionsOptions {
  startIso?: string;
  /** Exclusive upper bound on check_in (sessions with check_in < endIso) */
  endIso?: string;
  limit: number;
  offset: number;
}

/**
 * Paginated work_sessions for one user, optional check_in date range (UTC).
 */
export async function listSessionsForUser(
  userId: string,
  companyId: string,
  opts: ListSessionsOptions
): Promise<{ rows: WorkSessionRecord[]; total: number }> {
  let q = supabaseAdmin
    .from("work_sessions")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .order("check_in", { ascending: false });

  if (opts.startIso) {
    q = q.gte("check_in", opts.startIso);
  }
  if (opts.endIso) {
    q = q.lt("check_in", opts.endIso);
  }

  const { data, error, count } = await q.range(
    opts.offset,
    opts.offset + opts.limit - 1
  );

  if (error) throw error;
  return {
    rows: (data ?? []) as WorkSessionRecord[],
    total: count ?? 0,
  };
}

/**
 * Paginated company sessions, optional filter by user_id.
 */
export async function listSessionsForCompany(
  companyId: string,
  opts: ListSessionsOptions & { userId?: string; scopedUserIds?: string[] | null }
): Promise<{ rows: WorkSessionRecord[]; total: number }> {
  if (
    opts.scopedUserIds !== undefined &&
    opts.scopedUserIds !== null &&
    opts.scopedUserIds.length === 0
  ) {
    return { rows: [], total: 0 };
  }

  let q = supabaseAdmin
    .from("work_sessions")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("check_in", { ascending: false });

  if (opts.scopedUserIds !== undefined && opts.scopedUserIds !== null) {
    q = q.in("user_id", opts.scopedUserIds);
  }

  if (opts.userId) {
    q = q.eq("user_id", opts.userId);
  }
  if (opts.startIso) {
    q = q.gte("check_in", opts.startIso);
  }
  if (opts.endIso) {
    q = q.lt("check_in", opts.endIso);
  }

  const { data, error, count } = await q.range(
    opts.offset,
    opts.offset + opts.limit - 1
  );

  if (error) throw error;
  return {
    rows: (data ?? []) as WorkSessionRecord[],
    total: count ?? 0,
  };
}

