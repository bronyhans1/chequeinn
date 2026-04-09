import * as repo from "./leaveBalance.repository";
import * as usersRepo from "../users/users.repository";

export interface CreateLeaveBalanceInput {
  user_id: string;
  total_days: number;
  used_days?: number;
}

export interface UpdateLeaveBalanceInput {
  total_days?: number;
  used_days?: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
}

export async function getUserLeaveBalance(
  userId: string,
  companyId: string,
  restrictToBranchId?: string
): Promise<ServiceResult<repo.LeaveBalanceRecord>> {
  const user = await usersRepo.findByIdAndCompanyId(userId, companyId);
  if (!user) {
    return { data: null, error: "User not found" };
  }
  if (restrictToBranchId && user.branch_id !== restrictToBranchId) {
    return { data: null, error: "User not found" };
  }

  const balance = await repo.getLeaveBalance(userId, companyId);
  return { data: balance };
}

export async function createLeaveBalance(
  userId: string,
  companyId: string,
  data: CreateLeaveBalanceInput,
  restrictToBranchId?: string
): Promise<ServiceResult<repo.LeaveBalanceRecord>> {
  const user = await usersRepo.findByIdAndCompanyId(userId, companyId);
  if (!user) {
    return { data: null, error: "User not found" };
  }
  if (restrictToBranchId && user.branch_id !== restrictToBranchId) {
    return { data: null, error: "User not found" };
  }

  const existing = await repo.getLeaveBalance(userId, companyId);
  if (existing) {
    return { data: null, error: "Leave balance already exists for this user" };
  }

  const totalDays = Number(data.total_days);
  const usedDays = Number(data.used_days ?? 0);

  if (!Number.isFinite(totalDays) || totalDays < 0) {
    return { data: null, error: "total_days must be >= 0" };
  }
  if (!Number.isFinite(usedDays) || usedDays < 0) {
    return { data: null, error: "used_days must be >= 0" };
  }
  if (usedDays > totalDays) {
    return { data: null, error: "used_days cannot exceed total_days" };
  }

  const record = await repo.createLeaveBalance({
    user_id: userId,
    company_id: companyId,
    total_days: totalDays,
    used_days: usedDays,
  });
  return { data: record };
}

export async function updateLeaveBalance(
  balanceId: string,
  companyId: string,
  data: UpdateLeaveBalanceInput,
  restrictToBranchId?: string
): Promise<ServiceResult<repo.LeaveBalanceRecord>> {
  const existing = await repo.getLeaveBalanceById(balanceId, companyId);
  if (!existing) {
    return { data: null, error: "Leave balance not found" };
  }
  if (restrictToBranchId) {
    const owner = await usersRepo.findByIdAndCompanyId(existing.user_id, companyId);
    if (!owner || owner.branch_id !== restrictToBranchId) {
      return { data: null, error: "Leave balance not found" };
    }
  }

  let totalDays = existing.total_days;
  let usedDays = existing.used_days;

  if (data.total_days !== undefined) {
    const v = Number(data.total_days);
    if (!Number.isFinite(v) || v < 0) {
      return { data: null, error: "total_days must be >= 0" };
    }
    totalDays = v;
  }
  if (data.used_days !== undefined) {
    const v = Number(data.used_days);
    if (!Number.isFinite(v) || v < 0) {
      return { data: null, error: "used_days must be >= 0" };
    }
    usedDays = v;
  }

  if (usedDays > totalDays) {
    return { data: null, error: "used_days cannot exceed total_days" };
  }

  const updated = await repo.updateLeaveBalanceById(balanceId, companyId, {
    total_days: totalDays,
    used_days: usedDays,
  });
  if (!updated) {
    return { data: null, error: "Failed to update leave balance" };
  }
  return { data: updated };
}

export async function getCompanyLeaveBalances(
  companyId: string,
  filterUserIds?: string[] | null
): Promise<repo.LeaveBalanceRecord[]> {
  return repo.getCompanyLeaveBalances(companyId, filterUserIds);
}
