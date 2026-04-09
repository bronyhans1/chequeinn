import { supabaseAdmin } from "../../config/supabase";

import { normalizeRoles } from "../../config/roles";
import { isAllowedAccountStatus } from "../../lib/accountStatus";

import * as repo from "./users.repository";

import * as shiftsRepo from "../shifts/shifts.repository";

import * as platformRepo from "../platform/platform.repository";

import * as branchesRepo from "../branches/branches.repository";
import * as departmentsRepo from "../departments/departments.repository";



/** Roles company admins may assign when creating employees (not `admin`). */

const CREATABLE_ROLES = new Set(["employee", "manager", "HR"]);

/** Shown when dependents exist or a race adds history before hard delete completes. */
export const EMPLOYEE_DELETE_fallbackInactiveMessage =
  "This employee cannot be permanently deleted because historical records exist. The employee has been made inactive instead.";

export type DeleteEmployeeResult =
  | { success: true; outcome: "permanently_deleted" }
  | { success: true; outcome: "deactivated_due_to_records"; message: string }
  | { success: false; error: string };



export interface CreateEmployeeInput {

  first_name: string;

  last_name: string;

  email: string;

  /** Supabase Auth password — user signs in with email + this until reset. */

  temporary_password: string;

  /** Canonical company role name: employee | manager | HR */

  role: string;

  /** Optional; defaults to company default branch (Phase 1). */

  branch_id?: string;

}



export interface UpdateEmployeeInput {

  first_name?: string;

  last_name?: string;

  email?: string;

  /** Reassign user to another branch (same company). */

  branch_id?: string;

  /** Set to a department in the user's branch, or null to clear. */

  department_id?: string | null;

  /** Company admin / HR only (backend enforces). */
  status?: "active" | "inactive" | "suspended";

}



export type UserResponse = {

  id: string;

  first_name: string;

  last_name: string;

  email: string;

  company_id: string;
  company_name: string | null;

  branch_id: string;
  department_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone_number?: string | null;
  profile_photo_url?: string | null;

  status: "active" | "inactive" | "suspended";

  shift_id?: string | null;

  roles?: string[];

  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;

};



function isValidEmail(email: string): boolean {

  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return re.test(email);

}



function trimString(value: string | undefined): string | undefined {

  return typeof value === "string" ? value.trim() || undefined : undefined;

}



async function withRolesForUsers(users: repo.UserRecord[]): Promise<UserResponse[]> {

  const ids = users.map((u) => u.id);

  const map = await repo.fetchRoleNamesForUserIds(ids);

  const branchIds = [...new Set(users.map((u) => u.branch_id).filter(Boolean))];
  const deptIds = [
    ...new Set(users.map((u) => u.department_id).filter(Boolean)),
  ] as string[];
  const companyIds = [...new Set(users.map((u) => u.company_id).filter(Boolean))];

  const branchMap = await branchesRepo.findByIds(branchIds);
  const companiesRes = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .in("id", companyIds);
  const companyMap = new Map<string, string>();
  if (!companiesRes.error) {
    for (const c of (companiesRes.data ?? []) as Array<{ id: string; name: string }>) {
      companyMap.set(c.id, c.name);
    }
  }
  const depts = await Promise.all(
    deptIds.map((id) => departmentsRepo.findByIdAndCompanyId(id, users[0]?.company_id ?? ""))
  );
  const deptMap = new Map<string, { id: string; name: string }>();
  deptIds.forEach((id, i) => {
    const d = depts[i];
    if (d) deptMap.set(id, { id: d.id, name: d.name });
  });

  return users.map((u) => {

    const b = u.branch_id ? branchMap.get(u.branch_id) ?? null : null;

    return {

      id: u.id,

      first_name: u.first_name,

      last_name: u.last_name,

      email: u.email,

      company_id: u.company_id,
      company_name: companyMap.get(u.company_id) ?? null,

      branch_id: u.branch_id,
      department_id: u.department_id ?? null,
      date_of_birth: u.date_of_birth ?? null,
      gender: u.gender ?? null,
      phone_number: u.phone_number ?? null,
      profile_photo_url: u.profile_photo_url ?? null,

      status: u.status,

      shift_id: u.shift_id,

      roles: normalizeRoles(map.get(u.id) ?? []),

      branch: b ? { id: b.id, name: b.name } : null,
      department: u.department_id ? deptMap.get(u.department_id) ?? null : null,

    };

  });

}



export async function listEmployees(
  companyId: string,
  listBranchId?: string
): Promise<UserResponse[]> {

  const users = await repo.findAllByCompanyId(companyId, listBranchId);

  return withRolesForUsers(users);

}



export async function getEmployeeById(

  id: string,

  companyId: string,

  restrictToBranchId?: string

): Promise<UserResponse | null> {

  const user = await repo.findByIdAndCompanyId(id, companyId);

  if (!user) return null;

  if (restrictToBranchId && user.branch_id !== restrictToBranchId) return null;

  const [withRoles] = await withRolesForUsers([user]);

  return withRoles;

}



export async function createEmployee(

  companyId: string,

  input: CreateEmployeeInput,

  /** When set (manager/HR), new user is always created in this branch. */
  forceBranchId?: string

): Promise<{ user: UserResponse | null; error?: string }> {

  const first_name = trimString(input.first_name);

  const last_name = trimString(input.last_name);

  const email = trimString(input.email);

  const temporary_password =

    typeof input.temporary_password === "string" ? input.temporary_password : "";

  const roleRaw = trimString(input.role);



  if (!first_name) {

    return { user: null, error: "first_name is required" };

  }

  if (!last_name) {

    return { user: null, error: "last_name is required" };

  }

  if (!email) {

    return { user: null, error: "email is required" };

  }

  if (!isValidEmail(email)) {

    return { user: null, error: "email must be a valid email address" };

  }

  if (temporary_password.length < 6) {

    return {

      user: null,

      error: "temporary_password is required and must be at least 6 characters",

    };

  }

  if (!roleRaw || !CREATABLE_ROLES.has(roleRaw)) {

    return {

      user: null,

      error: "role must be one of: employee, manager, HR",

    };

  }



  const existingByEmail = await repo.findByEmailAndCompanyId(email, companyId);

  if (existingByEmail) {

    return { user: null, error: "User with this email already exists" };

  }



  const existingAnyCompany = await repo.findByEmailAnywhere(email);

  if (existingAnyCompany) {

    return { user: null, error: "This email is already registered in the system" };

  }



  let branchIdForUser: string;

  if (forceBranchId) {

    const br = await branchesRepo.findById(forceBranchId);

    if (!br || br.company_id !== companyId) {

      return { user: null, error: "branch_id is invalid for this company" };

    }

    branchIdForUser = br.id;

  } else {

    const branchRequested = trimString(input.branch_id);

    if (branchRequested) {

      const br = await branchesRepo.findById(branchRequested);

      if (!br || br.company_id !== companyId) {

        return { user: null, error: "branch_id is invalid for this company" };

      }

      branchIdForUser = br.id;

    } else {

      const def = await branchesRepo.ensureDefaultBranch(companyId);

      branchIdForUser = def.id;

    }

  }



  const { data: authData, error: authError } =

    await supabaseAdmin.auth.admin.createUser({

      email,

      password: temporary_password,

      email_confirm: true,

      user_metadata: {

        first_name,

        last_name,

      },

    });



  if (authError) {

    const msg = authError.message?.toLowerCase() ?? "";

    if (msg.includes("already") || msg.includes("registered")) {

      return {

        user: null,

        error: "An account with this email already exists in authentication",

      };

    }

    return { user: null, error: authError.message || "Failed to create auth user" };

  }



  const authUserId = authData.user?.id;

  if (!authUserId) {

    return { user: null, error: "Auth user creation did not return user id" };

  }



  try {

    await platformRepo.createAppUser(authUserId, companyId, {

      first_name,

      last_name,

      email,

      branch_id: branchIdForUser,

    });



    const roleId = await platformRepo.findRoleIdByName(roleRaw);

    if (!roleId) {

      throw new Error(`Role '${roleRaw}' not found in roles table`);

    }

    await platformRepo.assignRole(authUserId, roleId);

  } catch (err) {

    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    const message =

      err instanceof Error ? err.message : "Failed to create employee records";

    return { user: null, error: message };

  }



  const created = await repo.findByIdAndCompanyId(authUserId, companyId);

  if (!created) {

    return { user: null, error: "Failed to load created user" };

  }



  const [withRoles] = await withRolesForUsers([created]);

  return { user: withRoles };

}



export async function updateEmployee(

  id: string,

  companyId: string,

  input: UpdateEmployeeInput,
  restrictToBranchId?: string

): Promise<{
  user: UserResponse | null;
  error?: string;
  audit?: { department_auto_cleared?: boolean };
}> {

  const existing = await repo.findByIdAndCompanyId(id, companyId);

  if (!existing) {

    return { user: null, error: "User not found" };

  }
  if (restrictToBranchId && existing.branch_id !== restrictToBranchId) {
    return { user: null, error: "User not found" };
  }



  const updates: repo.UpdateUserInput = {};
  let departmentAutoCleared = false;

  if (input.first_name !== undefined) {

    const v = trimString(input.first_name);

    if (v !== undefined) updates.first_name = v;

  }

  if (input.last_name !== undefined) {

    const v = trimString(input.last_name);

    if (v !== undefined) updates.last_name = v;

  }

  if (input.email !== undefined) {

    const v = trimString(input.email);

    if (!v) return { user: null, error: "email cannot be empty" };

    if (!isValidEmail(v)) return { user: null, error: "email must be a valid email address" };



    const duplicate = await repo.findByEmailAndCompanyId(v, companyId);

    if (duplicate && duplicate.id !== id) {

      return { user: null, error: "User with this email already exists" };

    }



    updates.email = v;

  }

  let finalBranchId = existing.branch_id;

  if (input.branch_id !== undefined) {

    const v = trimString(input.branch_id);

    if (!v) {

      return { user: null, error: "branch_id cannot be empty" };

    }

    const br = await branchesRepo.findById(v);

    if (!br || br.company_id !== companyId) {

      return { user: null, error: "branch_id is invalid for this company" };

    }

    updates.branch_id = v;
    finalBranchId = v;

  }

  if (input.department_id !== undefined) {
    if (input.department_id === null) {
      updates.department_id = null;
    } else {
      const did = trimString(input.department_id);
      if (!did) {
        return { user: null, error: "department_id cannot be empty" };
      }
      const dept = await departmentsRepo.findByIdAndCompanyId(did, companyId);
      if (!dept || dept.branch_id !== finalBranchId) {
        return {
          user: null,
          error: "department_id must belong to the user's current branch",
        };
      }
      updates.department_id = did;
    }
  } else if (input.branch_id !== undefined && existing.department_id) {
    const dept = await departmentsRepo.findByIdAndCompanyId(
      existing.department_id,
      companyId
    );
    if (!dept || dept.branch_id !== finalBranchId) {
      updates.department_id = null;
      departmentAutoCleared = true;
    }
  }

  if (input.status !== undefined) {
    if (!isAllowedAccountStatus(input.status)) {
      return { user: null, error: "status must be one of: active, inactive, suspended" };
    }
    updates.status = input.status;
  }

  if (Object.keys(updates).length === 0) {

    return { user: await getEmployeeById(id, companyId, restrictToBranchId) };

  }



  const user = await repo.update(id, companyId, updates);

  if (!user) {

    return { user: null, error: "User not found" };

  }

  return {
    user: await getEmployeeById(id, companyId, restrictToBranchId),
    audit: departmentAutoCleared ? { department_auto_cleared: true } : undefined,
  };

}



export async function softDeleteEmployee(

  id: string,

  companyId: string,

  restrictToBranchId?: string,
  actor?: { userId: string; roles: string[] }

): Promise<DeleteEmployeeResult> {

  const existing = await repo.findByIdAndCompanyId(id, companyId);

  if (!existing) {

    return { success: false, error: "User not found" };

  }

  if (restrictToBranchId && existing.branch_id !== restrictToBranchId) {

    return { success: false, error: "User not found" };

  }

  if (actor) {
    const actorRoles = normalizeRoles(actor.roles);
    const targetRoles = normalizeRoles(
      (await repo.fetchRoleNamesForUserIds([id])).get(id) ?? []
    );
    const actorIsPlatformAdmin = actorRoles.includes("PLATFORM_ADMIN");
    const actorIsCompanyAdmin = actorRoles.includes("admin");
    const targetIsAdmin = targetRoles.includes("admin");

    if (actor.userId === id && (actorIsCompanyAdmin || actorIsPlatformAdmin)) {
      return { success: false, error: "You cannot delete your own account." };
    }

    if (actorIsPlatformAdmin) {
      // Platform admin can delete company admins and below.
    } else if (actorIsCompanyAdmin) {
      if (targetIsAdmin) {
        return {
          success: false,
          error: "Company admins cannot delete another admin account.",
        };
      }
    } else {
      return {
        success: false,
        error: "Only company admins can delete users.",
      };
    }
  }

  const hasBlockingRecords = await repo.employeeHasDeleteBlockingRecords(id, companyId);
  if (hasBlockingRecords) {
    const ok = await repo.softDelete(id, companyId);
    if (!ok) return { success: false, error: "User not found" };
    return {
      success: true,
      outcome: "deactivated_due_to_records",
      message: EMPLOYEE_DELETE_fallbackInactiveMessage,
    };
  }

  try {
    await repo.hardDeleteUserAppRecords(id, companyId);
  } catch (err) {
    console.error("hardDeleteUserAppRecords", err);
    const racedOrFk = await repo.employeeHasDeleteBlockingRecords(id, companyId);
    if (racedOrFk) {
      const ok = await repo.softDelete(id, companyId);
      if (!ok) return { success: false, error: "User not found" };
      return {
        success: true,
        outcome: "deactivated_due_to_records",
        message: EMPLOYEE_DELETE_fallbackInactiveMessage,
      };
    }
    return {
      success: false,
      error: "Could not remove this employee. Try again or contact support.",
    };
  }

  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (authErr) {
    console.error("auth.admin.deleteUser after hardDeleteUserAppRecords", authErr);
    return {
      success: false,
      error:
        "The employee profile was removed, but their sign-in account could not be deleted automatically. Contact support.",
    };
  }

  return { success: true, outcome: "permanently_deleted" };

}



export async function assignShift(

  userId: string,

  companyId: string,

  shiftId: string | null,

  restrictToBranchId?: string

): Promise<{ user: UserResponse | null; error?: string }> {

  const existing = await repo.findByIdAndCompanyId(userId, companyId);

  if (!existing) {

    return { user: null, error: "User not found" };

  }

  if (restrictToBranchId && existing.branch_id !== restrictToBranchId) {

    return { user: null, error: "User not found" };

  }



  if (shiftId !== null && shiftId !== undefined && shiftId !== "") {

    const shift = await shiftsRepo.getShiftById(shiftId, companyId);

    if (!shift) {

      return { user: null, error: "Shift not found or does not belong to this company" };

    }

  }



  const updated = await repo.assignShiftToUser(userId, companyId, shiftId ?? null);

  if (!updated) {

    return { user: null, error: "User not found" };

  }

  return { user: await getEmployeeById(userId, companyId) };

}


