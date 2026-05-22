import { supabaseAdmin } from "../../config/supabase";
import { normalizeRoles } from "../../config/roles";

export interface NotificationRecord {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
  email_sent_at: string | null;
  push_sent_at: string | null;
}

export async function existsByDedupeKey(
  companyId: string,
  userId: string,
  dedupeKey: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function insertNotification(input: {
  company_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  dedupe_key?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<NotificationRecord> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      company_id: input.company_id,
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body,
      dedupe_key: input.dedupe_key ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as NotificationRecord;
}

export async function markEmailSent(notificationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function listForUser(
  companyId: string,
  userId: string,
  limit: number,
  offset: number
): Promise<{ rows: NotificationRecord[]; total: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { data, error, count } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);
  if (error) throw error;
  return { rows: (data ?? []) as NotificationRecord[], total: count ?? 0 };
}

export async function countUnread(companyId: string, userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(
  notificationId: string,
  companyId: string,
  userId: string
): Promise<NotificationRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as NotificationRecord | null;
}

export async function markAllRead(companyId: string, userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Active users in company with any of the given role names (lowercase canonical). */
export async function listUserIdsByRoleNames(
  companyId: string,
  roleNames: string[]
): Promise<string[]> {
  const wanted = new Set(roleNames);
  const { data: roles, error: rolesErr } = await supabaseAdmin.from("roles").select("id, name");
  if (rolesErr) throw rolesErr;
  const roleIds = (roles ?? [])
    .filter((r) => {
      const canon = normalizeRoles([String(r.name)]);
      return canon.some((c) => wanted.has(c));
    })
    .map((r) => r.id as string);
  if (roleIds.length === 0) return [];

  const { data: userRoles, error: urErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role_id", roleIds);
  if (urErr) throw urErr;

  const userIds = [...new Set((userRoles ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) return [];

  const { data: users, error: uErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .in("id", userIds);
  if (uErr) throw uErr;
  return (users ?? []).map((u) => u.id as string);
}

export async function listOpenWorkSessions(limit = 300): Promise<
  Array<{
    id: string;
    user_id: string;
    company_id: string;
    check_in: string;
    shift_id: string | null;
    attendance_date: string | null;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("work_sessions")
    .select("id, user_id, company_id, check_in, shift_id, attendance_date")
    .eq("status", "ACTIVE")
    .is("check_out", null)
    .order("check_in", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    user_id: string;
    company_id: string;
    check_in: string;
    shift_id: string | null;
    attendance_date: string | null;
  }>;
}
