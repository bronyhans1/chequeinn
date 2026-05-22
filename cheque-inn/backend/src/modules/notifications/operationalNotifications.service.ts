import * as usersRepo from "../users/users.repository";
import { NotificationType } from "./notificationTypes";
import { dispatchNotification, dispatchToMany } from "./notificationDispatch.service";
import * as repo from "./notifications.repository";

export async function notifyLeaveSubmitted(params: {
  companyId: string;
  employeeUserId: string;
  leaveId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
}): Promise<void> {
  const employee = await usersRepo.getUserById(params.employeeUserId);
  const name =
    employee
      ? [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim()
      : "An employee";

  await dispatchNotification({
    companyId: params.companyId,
    userId: params.employeeUserId,
    type: NotificationType.LEAVE_SUBMITTED,
    title: "Leave request submitted",
    body: `Your ${params.leaveType} request (${params.startDate} → ${params.endDate}) is pending approval.`,
    dedupeKey: `leave_submitted:${params.leaveId}:employee`,
    metadata: { leave_id: params.leaveId },
    sendEmail: true,
  });

  const reviewers = await repo.listUserIdsByRoleNames(params.companyId, [
    "admin",
    "manager",
    "HR",
  ]);
  const targets = reviewers.filter((id) => id !== params.employeeUserId);
  await dispatchToMany(targets, {
    companyId: params.companyId,
    type: NotificationType.LEAVE_PENDING_REVIEW,
    title: "Leave needs review",
    body: `${name} requested ${params.leaveType} (${params.startDate} → ${params.endDate}).`,
    dedupeKey: `leave_pending:${params.leaveId}`,
    metadata: { leave_id: params.leaveId, employee_user_id: params.employeeUserId },
    sendEmail: true,
  });
}

export async function notifyLeaveApproved(params: {
  companyId: string;
  employeeUserId: string;
  leaveId: string;
  startDate: string;
  endDate: string;
}): Promise<void> {
  await dispatchNotification({
    companyId: params.companyId,
    userId: params.employeeUserId,
    type: NotificationType.LEAVE_APPROVED,
    title: "Leave approved",
    body: `Your leave (${params.startDate} → ${params.endDate}) was approved.`,
    dedupeKey: `leave_approved:${params.leaveId}`,
    metadata: { leave_id: params.leaveId },
    sendEmail: true,
  });
}

export async function notifyLeaveRejected(params: {
  companyId: string;
  employeeUserId: string;
  leaveId: string;
  startDate: string;
  endDate: string;
}): Promise<void> {
  await dispatchNotification({
    companyId: params.companyId,
    userId: params.employeeUserId,
    type: NotificationType.LEAVE_REJECTED,
    title: "Leave rejected",
    body: `Your leave (${params.startDate} → ${params.endDate}) was not approved.`,
    dedupeKey: `leave_rejected:${params.leaveId}`,
    metadata: { leave_id: params.leaveId },
    sendEmail: true,
  });
}

export async function notifyPayrollSyncFailure(params: {
  companyId: string;
  userId: string;
  failureKind: string;
  errorMessage: string;
  workSessionId?: string | null;
}): Promise<void> {
  const dedupeKey = `payroll_sync:${params.failureKind}:${params.userId}:${params.workSessionId ?? "monthly"}:${new Date().toISOString().slice(0, 10)}`;
  const hrAdmins = await repo.listUserIdsByRoleNames(params.companyId, ["admin", "HR"]);
  const targets = [...new Set([...hrAdmins, params.userId])];
  await dispatchToMany(targets, {
    companyId: params.companyId,
    type: NotificationType.PAYROLL_SYNC_FAILURE,
    title: "Payroll sync issue",
    body: `Payroll could not be updated (${params.failureKind}). Ask HR to review sync failures.`,
    dedupeKey,
    metadata: {
      failure_kind: params.failureKind,
      work_session_id: params.workSessionId,
      error_preview: params.errorMessage.slice(0, 200),
    },
    sendEmail: true,
  });
}

export async function notifyPayrollExportReady(params: {
  companyId: string;
  userId: string;
  year: number;
  month: number;
  format: "csv" | "xlsx";
}): Promise<void> {
  await dispatchNotification({
    companyId: params.companyId,
    userId: params.userId,
    type: NotificationType.PAYROLL_EXPORT_READY,
    title: "Payroll export ready",
    body: `Your ${params.format.toUpperCase()} export for ${params.year}-${String(params.month).padStart(2, "0")} completed.`,
    dedupeKey: `payroll_export:${params.userId}:${params.year}:${params.month}:${params.format}`,
    metadata: { year: params.year, month: params.month, format: params.format },
    sendEmail: false,
  });
}
