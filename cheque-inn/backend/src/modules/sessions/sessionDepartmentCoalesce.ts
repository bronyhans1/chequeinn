import * as usersRepo from "../users/users.repository";
import * as departmentsRepo from "../departments/departments.repository";

/**
 * Prefer department_id from the clock-in request; otherwise snapshot the employee's
 * assigned department when it belongs to the attendance branch (stored on work_sessions).
 */
export async function coalesceSessionDepartmentFromProfile(
  userId: string,
  companyId: string,
  attendanceBranchId: string,
  fromClockInRequest?: string
): Promise<string | undefined> {
  const explicit = fromClockInRequest?.trim();
  if (explicit) return explicit;

  const user = await usersRepo.getUserById(userId);
  const assigned = user?.department_id?.trim();
  if (!assigned) return undefined;

  const dept = await departmentsRepo.findByIdAndCompanyId(assigned, companyId);
  if (!dept || dept.branch_id !== attendanceBranchId) return undefined;

  return dept.id;
}
