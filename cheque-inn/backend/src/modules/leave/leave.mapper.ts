import type { LeaveRequestRecord } from "./leave.repository";

/** API shape: uppercase status + reviewed_* aliases (DB columns: approved_by / approved_at). */
export interface LeaveRequestApi {
  id: string;
  user_id: string;
  company_id: string;
  employee_name?: string | null;
  employee_email?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  approved_by: string | null;
  approved_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export function toLeaveApi(row: LeaveRequestRecord): LeaveRequestApi {
  const raw = (row.status ?? "pending").toLowerCase();
  const status =
    raw === "approved"
      ? "APPROVED"
      : raw === "rejected"
        ? "REJECTED"
        : "PENDING";
  return {
    ...row,
    status,
    reviewed_by: row.approved_by ?? null,
    reviewed_at: row.approved_at ?? null,
  };
}

export function toLeaveApiList(rows: LeaveRequestRecord[]): LeaveRequestApi[] {
  return rows.map(toLeaveApi);
}
