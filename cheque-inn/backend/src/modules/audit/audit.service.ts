import * as repo from "./audit.repository";

export async function logAction(
  companyId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown> | null
): Promise<void> {
  // actor_id = acting user id; metadata = serialized JSON (text column) or object (jsonb)
  const metadata =
    details != null ? JSON.stringify(details) : null;
  await repo.createAuditLog({
    company_id: companyId,
    actor_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

export async function getCompanyAuditLogs(
  companyId: string
): Promise<repo.AuditLogRecord[]> {
  return repo.getCompanyAuditLogs(companyId);
}

export async function getAuditLogsByEntity(
  companyId: string,
  entityType: string,
  entityId: string
): Promise<repo.AuditLogRecord[]> {
  return repo.getAuditLogsByEntity(companyId, entityType, entityId);
}
