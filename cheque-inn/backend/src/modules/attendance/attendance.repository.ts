import { supabaseAdmin } from "../../config/supabase";
import { WorkSessionStatus } from "../../constants/workSessionStatus";

export interface WorkSessionRow {
  id: string;
  company_id: string;
  user_id: string;
  check_in: string | null;
  check_out: string | null;
  duration_minutes: number | null;
  late_minutes?: number | null;
  shift_overtime_minutes?: number | null;
  early_leave_minutes?: number | null;
  half_day?: boolean | null;
  status: string;
  created_at: string;
  department_id?: string | null;
}

function getTodayRangeUtc(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function getMonthStartUtc(): string {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  return start.toISOString();
}

/** `undefined` = all company users; `[]` = none; else restrict to these user ids (manager/HR branch). */
export type ScopedUserIds = string[] | undefined;

function applySessionUserScope<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  scopedUserIds: ScopedUserIds
): T {
  if (scopedUserIds === undefined) return query;
  return query.in("user_id", scopedUserIds);
}

export async function getTodaySessions(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<WorkSessionRow[]> {
  if (scopedUserIds !== undefined && scopedUserIds.length === 0) {
    return [];
  }
  const { start, end } = getTodayRangeUtc();

  let q = supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("company_id", companyId)
    .gte("check_in", start)
    .lt("check_in", end);

  q = applySessionUserScope(q, scopedUserIds);

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as WorkSessionRow[];
}

export async function getUserSessions(
  userId: string,
  companyId: string,
  limit?: number,
  offset?: number
): Promise<{ rows: WorkSessionRow[]; total: number }> {
  let query = supabaseAdmin
    .from("work_sessions")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .order("check_in", { ascending: false });

  if (
    typeof limit === "number" &&
    typeof offset === "number" &&
    limit > 0 &&
    offset >= 0
  ) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    rows: (data ?? []) as WorkSessionRow[],
    total: count ?? 0,
  };
}

export async function getMonthSessions(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<WorkSessionRow[]> {
  if (scopedUserIds !== undefined && scopedUserIds.length === 0) {
    return [];
  }
  const monthStart = getMonthStartUtc();

  let q = supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("company_id", companyId)
    .gte("check_in", monthStart);

  q = applySessionUserScope(q, scopedUserIds);

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as WorkSessionRow[];
}

export async function getUserMonthSessions(
  userId: string,
  companyId: string
): Promise<WorkSessionRow[]> {
  const monthStart = getMonthStartUtc();

  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("*")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .gte("check_in", monthStart)
    .order("check_in", { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkSessionRow[];
}

export async function getActiveSessions(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<Array<Pick<WorkSessionRow, "user_id" | "check_in" | "department_id">>> {
  if (scopedUserIds !== undefined && scopedUserIds.length === 0) {
    return [];
  }

  let q = supabaseAdmin
    .from("work_sessions")
    .select("user_id, check_in, department_id")
    .eq("company_id", companyId)
    .eq("status", WorkSessionStatus.ACTIVE)
    .is("check_out", null);

  q = applySessionUserScope(q, scopedUserIds);

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as Array<
    Pick<WorkSessionRow, "user_id" | "check_in" | "department_id">
  >;
}

/**
 * Returns user IDs who belong to the company (or scoped set) and have no work_session today
 */
export async function getUsersWithoutSessionToday(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<string[]> {
  const { start, end } = getTodayRangeUtc();

  let allUserIds: Set<string>;
  if (scopedUserIds !== undefined) {
    if (scopedUserIds.length === 0) return [];
    allUserIds = new Set(scopedUserIds);
  } else {
    const { data: companyUserIds, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "active");

    if (usersError) throw usersError;
    allUserIds = new Set((companyUserIds ?? []).map((r: { id: string }) => r.id));
  }

  let sq = supabaseAdmin
    .from("work_sessions")
    .select("user_id")
    .eq("company_id", companyId)
    .gte("check_in", start)
    .lt("check_in", end);

  if (scopedUserIds !== undefined && scopedUserIds.length > 0) {
    sq = sq.in("user_id", scopedUserIds);
  }

  const { data: sessionsToday, error: sessionsError } = await sq;

  if (sessionsError) throw sessionsError;
  const userIdsWithSession = new Set(
    (sessionsToday ?? []).map((r: { user_id: string }) => r.user_id)
  );

  const withoutSession = [...allUserIds].filter((id) => !userIdsWithSession.has(id));
  return withoutSession;
}

export async function getSessionsWithLatenessInRange(
  companyId: string,
  startIso: string,
  endIso: string,
  scopedUserIds?: ScopedUserIds
): Promise<Array<{ user_id: string; check_in: string | null; late_minutes: number | null }>> {
  if (scopedUserIds !== undefined && scopedUserIds.length === 0) {
    return [];
  }

  let q = supabaseAdmin
    .from("work_sessions")
    .select("user_id, check_in, late_minutes")
    .eq("company_id", companyId)
    .gte("check_in", startIso)
    .lt("check_in", endIso)
    .gt("late_minutes", 0);

  q = applySessionUserScope(q, scopedUserIds);

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as Array<{
    user_id: string;
    check_in: string | null;
    late_minutes: number | null;
  }>;
}

export interface FlagSessionRow {
  user_id: string;
  check_in: string | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  half_day: boolean | null;
}

export async function getSessionsInDateRangeForFlags(
  companyId: string,
  startIso: string,
  endIso: string,
  scopedUserIds?: ScopedUserIds
): Promise<FlagSessionRow[]> {
  if (scopedUserIds !== undefined && scopedUserIds.length === 0) {
    return [];
  }

  let q = supabaseAdmin
    .from("work_sessions")
    .select("user_id, check_in, late_minutes, early_leave_minutes, half_day")
    .eq("company_id", companyId)
    .eq("status", WorkSessionStatus.COMPLETED)
    .not("check_out", "is", null)
    .gte("check_in", startIso)
    .lt("check_in", endIso);

  q = applySessionUserScope(q, scopedUserIds);

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []) as FlagSessionRow[];
}

export async function getCompletedSessionUserDatesInRange(
  companyId: string,
  startIso: string,
  endIso: string,
  scopedUserIds?: ScopedUserIds
): Promise<Array<{ user_id: string; date: string }>> {
  if (scopedUserIds !== undefined && scopedUserIds.length === 0) {
    return [];
  }

  let q = supabaseAdmin
    .from("work_sessions")
    .select("user_id, check_in")
    .eq("company_id", companyId)
    .eq("status", WorkSessionStatus.COMPLETED)
    .not("check_out", "is", null)
    .gte("check_in", startIso)
    .lt("check_in", endIso);

  q = applySessionUserScope(q, scopedUserIds);

  const { data, error } = await q;

  if (error) throw error;
  const rows = (data ?? []) as Array<{ user_id: string; check_in: string | null }>;
  return rows
    .filter((r) => r.check_in)
    .map((r) => ({ user_id: r.user_id, date: r.check_in!.slice(0, 10) }));
}
