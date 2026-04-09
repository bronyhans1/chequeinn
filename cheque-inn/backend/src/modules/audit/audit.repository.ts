import { supabaseAdmin } from "../../config/supabase";

export interface AuditLogRecord {
  id: string;
  company_id: string;
  actor_id: string;
  /** Human-friendly actor display name (resolved from users table when possible). */
  actor_name?: string | null;
  /** Human-friendly actor email (resolved from users table when possible). */
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | Record<string, unknown> | null;
  created_at: string;
}

export interface CreateAuditLogData {
  company_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: string | Record<string, unknown> | null;
}

export async function createAuditLog(
  data: CreateAuditLogData
): Promise<AuditLogRecord> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      company_id: data.company_id,
      actor_id: data.actor_id,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      metadata: data.metadata ?? null,
      created_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return row as AuditLogRecord;
}

export async function getCompanyAuditLogs(
  companyId: string
): Promise<AuditLogRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const logs = (data ?? []) as AuditLogRecord[];
  return enrichAuditActors(logs);
}

export async function getAuditLogsByEntity(
  companyId: string,
  entityType: string,
  entityId: string
): Promise<AuditLogRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .eq("company_id", companyId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const logs = (data ?? []) as AuditLogRecord[];
  return enrichAuditActors(logs);
}

async function enrichAuditActors(logs: AuditLogRecord[]): Promise<AuditLogRecord[]> {
  if (logs.length === 0) return logs;

  const actorIds = Array.from(
    new Set(logs.map((l) => l.actor_id).filter((id) => typeof id === "string" && id.length > 0))
  );

  if (actorIds.length === 0) {
    return logs.map((l) => ({
      ...l,
      actor_name: null,
      actor_email: null,
    }));
  }

  // Safe fallback: if lookup fails, keep the endpoint working with existing actor_id.
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", actorIds);

    if (error) {
      console.error("enrichAuditActors users lookup error", error);
      return logs.map((l) => ({ ...l, actor_name: null, actor_email: null }));
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

    return logs.map((l) => {
      const resolved = userById.get(l.actor_id);
      return {
        ...l,
        actor_name: resolved?.name ?? null,
        actor_email: resolved?.email ?? null,
      };
    });
  } catch (err) {
    console.error("enrichAuditActors exception", err);
    return logs.map((l) => ({ ...l, actor_name: null, actor_email: null }));
  }
}
