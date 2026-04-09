/**
 * Canonical `work_sessions.status` values — must match Postgres
 * `chk_work_sessions_status` (see scripts/supabase_payroll_schema.sql):
 * CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
 */
export const WorkSessionStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type WorkSessionStatusValue =
  (typeof WorkSessionStatus)[keyof typeof WorkSessionStatus];
