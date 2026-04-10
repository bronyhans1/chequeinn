import type { AuditLog } from "@/lib/api/audit.api";
import type { UserListItem } from "@/lib/api/users.api";

const MANUAL_REASON_LABELS: Record<string, string> = {
  app_or_network_issue: "App or network issue",
  device_battery_dead: "Device battery dead",
  phone_unavailable: "Phone unavailable",
  missed_scan: "Missed scan",
  supervisor_override: "Supervisor override",
  other: "Other",
};

export type PresentAuditLogOptions = {
  employeeDisplayById?: ReadonlyMap<string, string>;
};

export function buildAuditEmployeeDisplayLookup(users: readonly UserListItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of users) {
    const first = typeof u.first_name === "string" ? u.first_name.trim() : "";
    const last = typeof u.last_name === "string" ? u.last_name.trim() : "";
    const full = [first, last].filter(Boolean).join(" ");
    const label = full || (typeof u.email === "string" ? u.email.trim() : "") || u.id;
    m.set(u.id, label);
  }
  return m;
}

/** Alias for audit/dashboard callers (`buildAuditEmployeeDisplayLookup`). */
export const buildEmployeeDisplayById = buildAuditEmployeeDisplayLookup;

export function parseAuditMetadata(metadata: AuditLog["metadata"]): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof metadata === "object") {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function quoteIfText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return `"${v}"`;
}

/** User-visible label for a manual attendance reason code. */
export function formatManualAttendanceReason(reason: unknown): string {
  if (typeof reason !== "string" || !reason.trim()) return "—";
  const key = reason.trim();
  return (
    MANUAL_REASON_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function isManualAttendanceAction(action: string): boolean {
  return action === "session.manual_clock_in" || action === "session.manual_clock_out";
}

export function employeeTargetFromMeta(
  meta: Record<string, unknown> | null,
  employeeDisplayById?: ReadonlyMap<string, string>
): string {
  if (!meta) return "Employee";
  const name = typeof meta.target_user_name === "string" ? meta.target_user_name.trim() : "";
  if (name) return name;
  const email = typeof meta.target_user_email === "string" ? meta.target_user_email.trim() : "";
  if (email) return email;
  const id = typeof meta.target_user_id === "string" ? meta.target_user_id.trim() : "";
  if (id) {
    const fromLookup = employeeDisplayById?.get(id);
    if (fromLookup) return fromLookup;
  }
  return "Employee";
}

function buildManualAttendanceDetail(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  parts.push(`Reason: ${formatManualAttendanceReason(meta.manual_reason)}`);
  const note = typeof meta.manual_note === "string" ? meta.manual_note.trim() : "";
  if (note) parts.push(`Note: ${note}`);
  return parts.join(" · ");
}

function titleCaseActionFallback(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

/**
 * Short, user-facing title for an audit row (replaces raw action keys like session.manual_clock_in).
 */
export function friendlyAuditActionTitle(action: string, meta: Record<string, unknown> | null): string {
  const role = typeof meta?.role === "string" ? meta.role.toLowerCase() : null;
  const name = quoteIfText(meta?.name);

  switch (action) {
    case "user.create":
      if (role === "hr") return "Added a new HR user";
      if (role === "manager") return "Added a new manager";
      if (role === "employee") return "Added a new employee";
      return "Added a new user";
    case "user.update":
      if (meta?.department_auto_cleared === true) {
        return "Cleared a user's department after a branch change";
      }
      if (meta?.department_updated === true) {
        return "Updated a user's department";
      }
      if (meta?.branch_updated === true) return "Updated a user's branch";
      if (meta?.email_updated === true) return "Updated a user's email";
      if (meta?.first_name_updated === true || meta?.last_name_updated === true) {
        return "Updated a user's profile";
      }
      return "Updated a user";
    case "user.delete":
      return "Deleted a user";
    case "user.assign_shift":
      return "Updated an employee's shift";
    case "branch.create":
      return name ? `Created branch ${name}` : "Created a new branch";
    case "branch.update":
      if (meta?.attendance_updated === true) return "Updated branch attendance settings";
      return name ? `Updated branch ${name}` : "Updated a branch";
    case "branch.delete":
      return "Deleted a branch";
    case "department.create":
      return "Created a new department";
    case "department.update":
      return "Updated a department";
    case "department.delete":
      return "Deleted a department";
    case "session.manual_clock_in":
      return "Manually checked in an employee";
    case "session.manual_clock_out":
      return "Manually checked out an employee";
    case "session.clock_in":
      return "Checked in";
    case "session.clock_out":
      return "Checked out";
    default:
      return titleCaseActionFallback(action);
  }
}

/**
 * Human-readable target summary (no raw UUIDs in normal presentation).
 */
export function friendlyAuditTargetLabel(
  log: AuditLog,
  meta: Record<string, unknown> | null,
  employeeDisplayById?: ReadonlyMap<string, string>
): string {
  if (isManualAttendanceAction(log.action)) {
    const who = employeeTargetFromMeta(meta, employeeDisplayById);
    return who === "Employee" ? "Employee · Recorded earlier" : `Employee · ${who}`;
  }

  switch (log.entity_type) {
    case "work_session":
      return "Work session";
    case "user":
      return "User account";
    case "branch":
      return typeof meta?.name === "string" && meta.name.trim() ? `Branch · ${meta.name.trim()}` : "Branch";
    case "department":
      return "Department";
    case "company_policy":
      return "Company policy";
    case "wage_rate":
      return "Wage rate";
    case "company_holiday":
      return "Company holiday";
    case "payroll_record":
      return "Payroll record";
    default:
      return log.entity_type ? log.entity_type.replace(/_/g, " ") : "—";
  }
}

/**
 * Secondary line for dashboard cards / audit details column (no JSON blobs).
 */
export function friendlyAuditDetailSummary(log: AuditLog, meta: Record<string, unknown> | null): string | null {
  if (isManualAttendanceAction(log.action)) {
    return buildManualAttendanceDetail(meta);
  }
  if (log.action === "user.create" && meta && typeof meta.role === "string") {
    return `Role: ${meta.role}`;
  }
  if (log.action === "branch.create" || log.action === "branch.update") {
    const n = typeof meta?.name === "string" ? meta.name.trim() : "";
    return n ? `Branch name: ${n}` : null;
  }
  return null;
}

/** Single-row presentation for dashboard and audit table columns. */
export function presentAuditLog(
  log: AuditLog,
  options?: PresentAuditLogOptions
): {
  actionLabel: string;
  targetLabel: string;
  detail: string | null;
} {
  const meta = parseAuditMetadata(log.metadata);
  const employeeDisplayById = options?.employeeDisplayById;
  return {
    actionLabel: friendlyAuditActionTitle(log.action, meta),
    targetLabel: friendlyAuditTargetLabel(log, meta, employeeDisplayById),
    detail: friendlyAuditDetailSummary(log, meta),
  };
}
