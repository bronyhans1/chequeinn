import * as repo from "./leave.repository";

export interface RequestLeaveInput {
  start_date: string;
  end_date: string;
  leave_type: string;
  reason?: string | null;
}

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
}

function trim(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export async function requestLeave(
  userId: string,
  companyId: string,
  data: RequestLeaveInput
): Promise<ServiceResult<repo.LeaveRequestRecord>> {
  const startDateStr = trim(data.start_date);
  const endDateStr = trim(data.end_date);
  const leaveType = trim(data.leave_type);
  const reason = data.reason !== undefined ? trim(data.reason) ?? null : null;

  if (!startDateStr || !endDateStr) {
    return { data: null, error: "start_date and end_date are required" };
  }
  if (!leaveType) {
    return { data: null, error: "leave_type is required" };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { data: null, error: "Invalid date format" };
  }

  if (startDate > endDate) {
    return { data: null, error: "start_date must be before or equal to end_date" };
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (totalDays < 1) {
    return { data: null, error: "Invalid date range" };
  }

  const balance = await repo.getLeaveBalance(userId, companyId);
  if (!balance) {
    return {
      data: null,
      error:
        "Leave balance has not been set up for your account. Ask HR to assign your leave allocation before requesting time off.",
    };
  }
  const remaining = (balance.total_days ?? 0) - (balance.used_days ?? 0);
  if (totalDays > remaining) {
    return {
      data: null,
      error: "Insufficient leave balance",
    };
  }

  const request = await repo.createLeaveRequest({
    user_id: userId,
    company_id: companyId,
    start_date: startDateStr,
    end_date: endDateStr,
    leave_type: leaveType,
    reason,
    total_days: totalDays,
    status: "pending",
  });

  return { data: request };
}

/** When `allowedUserIds` is set, the leave request’s employee must be in that set (manager/HR branch). */
export interface LeaveActionScope {
  allowedUserIds?: string[] | null;
}

export async function approveLeave(
  leaveId: string,
  companyId: string,
  approverId: string,
  scope?: LeaveActionScope
): Promise<ServiceResult<repo.LeaveRequestRecord>> {
  const leave = await repo.getLeaveById(leaveId);
  if (!leave) {
    return { data: null, error: "Leave request not found" };
  }
  if (leave.company_id !== companyId) {
    return { data: null, error: "Leave request not found" };
  }
  if (scope?.allowedUserIds != null && !scope.allowedUserIds.includes(leave.user_id)) {
    return { data: null, error: "Leave request not found" };
  }
  if (leave.status !== "pending") {
    return { data: null, error: "Leave request is not pending" };
  }

  try {
    const updated = await repo.approveLeaveRequestTransaction(
      leaveId,
      companyId,
      approverId
    );
    return { data: updated };
  } catch (err) {
    const e = err as Error & { code?: string };
    const code = e.code ?? "";
    if (code === "leave_not_found") {
      return { data: null, error: "Leave request not found" };
    }
    if (code === "leave_not_pending") {
      return { data: null, error: "Leave request is not pending" };
    }
    if (code === "leave_balance_missing") {
      return {
        data: null,
        error:
          "Cannot approve: leave balance is not configured for this employee. Create a balance before approving.",
      };
    }
    if (code === "leave_balance_insufficient") {
      return {
        data: null,
        error: "Cannot approve: insufficient leave balance remaining for this allocation.",
      };
    }
    console.error("approveLeave transaction error", err);
    return { data: null, error: "Failed to approve leave request" };
  }
}

export async function rejectLeave(
  leaveId: string,
  companyId: string,
  reviewerId: string,
  scope?: LeaveActionScope
): Promise<ServiceResult<repo.LeaveRequestRecord>> {
  const leave = await repo.getLeaveById(leaveId);
  if (!leave) {
    return { data: null, error: "Leave request not found" };
  }
  if (leave.company_id !== companyId) {
    return { data: null, error: "Leave request not found" };
  }
  if (scope?.allowedUserIds != null && !scope.allowedUserIds.includes(leave.user_id)) {
    return { data: null, error: "Leave request not found" };
  }
  if (leave.status !== "pending") {
    return { data: null, error: "Leave request is not pending" };
  }

  const now = new Date().toISOString();
  const updated = await repo.updateLeaveStatus(
    leaveId,
    "rejected",
    reviewerId,
    now
  );
  if (!updated) {
    return { data: null, error: "Failed to update leave request" };
  }

  return { data: updated };
}

export type ReviewLeaveAction = "approve" | "reject";

export async function reviewLeave(
  leaveId: string,
  companyId: string,
  reviewerId: string,
  action: ReviewLeaveAction,
  scope?: LeaveActionScope
): Promise<ServiceResult<repo.LeaveRequestRecord>> {
  if (action === "approve") {
    return approveLeave(leaveId, companyId, reviewerId, scope);
  }
  return rejectLeave(leaveId, companyId, reviewerId, scope);
}

export async function getMyLeaveRequests(
  userId: string
): Promise<repo.LeaveRequestRecord[]> {
  return repo.getUserLeaveRequests(userId);
}

export async function getCompanyLeaveRequests(
  companyId: string,
  statusFilter?: string | null,
  filterUserIds?: string[] | null
): Promise<repo.LeaveRequestRecord[]> {
  return repo.getCompanyLeaveRequests(companyId, statusFilter, filterUserIds);
}
