import * as repo from "./sessions.repository";
import { WorkSessionStatus } from "../../constants/workSessionStatus";
import * as departmentsRepo from "../departments/departments.repository";
import * as branchesRepo from "../branches/branches.repository";
import * as shiftsRepo from "../shifts/shifts.repository";
import * as usersRepo from "../users/users.repository";
import * as payrollService from "../payroll/payroll.service";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";
import { syncSalaryMonthForUserIfMonthly } from "../payroll/salaryEarnings.service";
import * as payrollSyncFailuresRepo from "../payroll/payrollSyncFailures.repository";
import type { ManualAttendanceReasonCode } from "../../constants/manualAttendance";
import { computeEarlyLeaveAndHalfDay as computeEarlyLeaveAndHalfDayPure } from "./earlyLeaveHalfDay";
import { coalesceSessionDepartmentFromProfile } from "./sessionDepartmentCoalesce";
import { checkBranchGeofence } from "../../lib/validateAttendanceQr";
import { shiftRowActive } from "../shifts/shifts.service";
import {
  lateMinutesAtCheckIn,
  overtimeMinutesAtCheckOut,
  resolveWindowAtCheckIn,
  toShiftWindowSource,
} from "../../lib/shiftWindow";
import { parseTimeToMinutes } from "../../lib/shiftTimeModel";
import {
  businessTodayUtcRange,
  calendarYmdInTimeZone,
  normalizeBusinessTimeZone,
} from "../../lib/businessCalendar";
import {
  EMPLOYEE_MSG_CHECKIN_ONLY_ASSIGNED_OFFICE,
  EMPLOYEE_MSG_DEPT_NOT_IN_OFFICE,
  EMPLOYEE_MSG_INVALID_DEPT_FOR_OFFICE,
  EMPLOYEE_MSG_NO_OFFICE_ASSIGNED,
  EMPLOYEE_MSG_OFFICE_LOCATION_VERIFY_FAILED,
} from "../../constants/employeeAttendanceMessages";

export interface ClockInInput {
  /** Optional department within the attendance branch. */
  department_id?: string;
  /** Physical attendance branch; must match the employee's assigned branch. */
  branch_id?: string;
  /** Required for self-service check-in (geofence vs branch). */
  latitude?: number;
  longitude?: number;
}

export interface ManualAttendanceMeta {
  reason: ManualAttendanceReasonCode;
  note: string | null;
  actorUserId: string;
}

export type AttendanceSyncWarningCode =
  | "SESSION_PAYROLL_FAILED"
  | "SALARY_MONTH_SYNC_FAILED";

export interface AttendanceSyncWarning {
  code: AttendanceSyncWarningCode;
  message: string;
}

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
  warnings?: AttendanceSyncWarning[];
}

function isPostgresUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

async function runPostClockOutPayroll(
  updated: repo.WorkSessionRecord,
  companyId: string,
  checkInIso: string | null
): Promise<AttendanceSyncWarning[]> {
  const warnings: AttendanceSyncWarning[] = [];
  const payrollOn = await companyPolicyService.isPayrollEnabled(companyId);
  if (!payrollOn) return warnings;

  const pr = await payrollService.processSessionPayroll(updated.id);
  if (pr.status === "failed") {
    const msg = pr.error;
    warnings.push({
      code: "SESSION_PAYROLL_FAILED",
      message:
        "Session payroll could not be recorded. Your clock-out is saved; ask an admin to check Payroll sync failures.",
    });
    try {
      await payrollSyncFailuresRepo.insertPayrollSyncFailure({
        company_id: companyId,
        user_id: updated.user_id,
        work_session_id: updated.id,
        failure_kind: "session_payroll",
        error_message: msg,
      });
    } catch (e) {
      console.error("persist payroll_sync_failure (session_payroll)", e);
    }
  }

  if (checkInIso) {
    try {
      await syncSalaryMonthForUserIfMonthly(
        updated.user_id,
        companyId,
        checkInIso,
        updated.attendance_date
      );
    } catch (salaryErr) {
      const msg =
        salaryErr instanceof Error ? salaryErr.message : String(salaryErr);
      warnings.push({
        code: "SALARY_MONTH_SYNC_FAILED",
        message:
          "Monthly salary totals may be out of date after this clock-out. Ask an admin to review Payroll sync failures.",
      });
      try {
        await payrollSyncFailuresRepo.insertPayrollSyncFailure({
          company_id: companyId,
          user_id: updated.user_id,
          work_session_id: updated.id,
          failure_kind: "salary_month_sync",
          error_message: msg,
        });
      } catch (e) {
        console.error("persist payroll_sync_failure (salary_month_sync)", e);
      }
    }
  }

  return warnings;
}

function nowIso(): string {
  return new Date().toISOString();
}

function calculateTotalHours(
  checkInIso: string,
  checkOutIso: string
): number {
  const checkIn = new Date(checkInIso);
  const checkOut = new Date(checkOutIso);
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  // round to 2 decimal places
  return Math.round(hours * 100) / 100;
}

async function resolveClockInBranchAndDepartment(
  userId: string,
  companyId: string,
  input: ClockInInput
): Promise<
  | { ok: true; attendanceBranchId: string; departmentId?: string }
  | { ok: false; error: string }
> {
  const user = await usersRepo.getUserById(userId);
  if (!user || user.company_id !== companyId) {
    return { ok: false, error: "User not found" };
  }
  if (!user.branch_id) {
    return { ok: false, error: EMPLOYEE_MSG_NO_OFFICE_ASSIGNED };
  }

  const userBranch = user.branch_id;

  if (input.branch_id?.trim()) {
    const bid = input.branch_id.trim();
    if (bid !== userBranch) {
      return { ok: false, error: EMPLOYEE_MSG_CHECKIN_ONLY_ASSIGNED_OFFICE };
    }
    if (input.department_id?.trim()) {
      const dept = await departmentsRepo.findByIdAndCompanyId(
        input.department_id.trim(),
        companyId
      );
      if (!dept || dept.branch_id !== userBranch) {
        return { ok: false, error: EMPLOYEE_MSG_INVALID_DEPT_FOR_OFFICE };
      }
      return { ok: true, attendanceBranchId: bid, departmentId: dept.id };
    }
    return { ok: true, attendanceBranchId: bid };
  }

  if (input.department_id?.trim()) {
    const dept = await departmentsRepo.findByIdAndCompanyId(
      input.department_id.trim(),
      companyId
    );
    if (!dept) {
      return { ok: false, error: "Department not found" };
    }
    if (dept.branch_id !== userBranch) {
      return { ok: false, error: EMPLOYEE_MSG_DEPT_NOT_IN_OFFICE };
    }
    return {
      ok: true,
      attendanceBranchId: dept.branch_id,
      departmentId: dept.id,
    };
  }

  return { ok: true, attendanceBranchId: userBranch };
}

async function resolveBranchForOpenSession(
  session: repo.WorkSessionRecord,
  companyId: string,
  userId: string
): Promise<Awaited<ReturnType<typeof branchesRepo.findById>>> {
  if (session.branch_id) {
    const b = await branchesRepo.findById(session.branch_id);
    if (b && b.company_id === companyId) return b;
  }
  if (session.department_id) {
    const dept = await departmentsRepo.findByIdAndCompanyId(
      session.department_id,
      companyId
    );
    if (dept?.branch_id) {
      const b = await branchesRepo.findById(dept.branch_id);
      if (b && b.company_id === companyId) return b;
    }
  }
  const user = await usersRepo.getUserById(userId);
  if (user?.branch_id) {
    return branchesRepo.findById(user.branch_id);
  }
  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

async function getCompanyBusinessTimeZone(companyId: string): Promise<string> {
  const policy = await companyPolicyService.getPolicy(companyId);
  const raw = (policy as { business_timezone?: string | null } | null)?.business_timezone;
  return normalizeBusinessTimeZone(typeof raw === "string" ? raw : null);
}

/**
 * Lateness vs shift start — centralized through resolveShiftWindow().
 */
async function getShiftInfoForClockIn(
  userId: string,
  companyId: string,
  checkInIso: string
): Promise<{
  shiftId?: string;
  lateMinutes: number;
  shiftEntity: shiftsRepo.ShiftRecord | null;
}> {
  try {
    const businessTz = await getCompanyBusinessTimeZone(companyId);
    const policy = await companyPolicyService.getPolicy(companyId);
    const overnightOn = policy.overnight_shifts_enabled === true;
    let shift: shiftsRepo.ShiftRecord | null = null;

    const user = await usersRepo.getUserById(userId);
    if (user?.shift_id) {
      const s = await shiftsRepo.getShiftById(user.shift_id, companyId);
      if (s && shiftRowActive(s)) shift = s;
    }

    if (!shift) {
      const rows = await shiftsRepo.getShifts(companyId);
      const active = rows.filter(shiftRowActive);
      if (!active.length) {
        return { shiftId: undefined, lateMinutes: 0, shiftEntity: null };
      }
      shift = active[0];
    }

    const late = lateMinutesAtCheckIn({
      checkInIso,
      businessTimeZone: businessTz,
      overnightShiftsEnabled: overnightOn,
      shift: toShiftWindowSource(shift),
    });
    return { shiftId: shift.id, lateMinutes: late, shiftEntity: shift };
  } catch {
    return { shiftId: undefined, lateMinutes: 0, shiftEntity: null };
  }
}

/**
 * Shift-end overtime — centralized through resolveShiftWindow() (check-in anchored).
 */
async function getOvertimeMinutes(
  shiftId: string | null | undefined,
  companyId: string,
  checkInIso: string,
  checkOutIso: string
): Promise<number> {
  if (!shiftId) return 0;
  try {
    const shift = await shiftsRepo.getShiftById(shiftId, companyId);
    if (!shift) return 0;

    const businessTz = await getCompanyBusinessTimeZone(companyId);
    const policy = await companyPolicyService.getPolicy(companyId);
    return overtimeMinutesAtCheckOut({
      checkInIso,
      checkOutIso,
      businessTimeZone: businessTz,
      overnightShiftsEnabled: policy.overnight_shifts_enabled === true,
      shift: toShiftWindowSource(shift),
    });
  } catch {
    return 0;
  }
}

/**
 * Compute early_leave_minutes and half_day from shift (loads shift, then delegates to pure timeline logic).
 */
async function getEarlyLeaveAndHalfDay(
  shiftId: string | null | undefined,
  companyId: string,
  checkInIso: string,
  checkOutIso: string,
  durationMinutes: number
): Promise<{ earlyLeaveMinutes: number; halfDay: boolean }> {
  if (!shiftId || durationMinutes < 0) {
    return { earlyLeaveMinutes: 0, halfDay: false };
  }
  try {
    const shift = await shiftsRepo.getShiftById(shiftId, companyId);
    if (!shift) return { earlyLeaveMinutes: 0, halfDay: false };

    const startM = parseTimeToMinutes(shift.start_time);
    const endM = parseTimeToMinutes(shift.end_time);
    if (startM === null || endM === null) return { earlyLeaveMinutes: 0, halfDay: false };

    return computeEarlyLeaveAndHalfDayPure(
      startM,
      endM,
      checkInIso,
      checkOutIso,
      durationMinutes
    );
  } catch {
    return { earlyLeaveMinutes: 0, halfDay: false };
  }
}

export async function clockIn(
  userId: string,
  companyId: string,
  input: ClockInInput,
  options?: { manual?: boolean; manualAttendance?: ManualAttendanceMeta }
): Promise<ServiceResult<repo.WorkSessionRecord>> {
  const existing = await repo.findOpenSessionByUser(userId, companyId);
  if (existing) {
    return {
      data: null,
      error: "You already have an active clock-in session",
    };
  }

  const resolved = await resolveClockInBranchAndDepartment(userId, companyId, input);
  if (!resolved.ok) {
    return { data: null, error: resolved.error };
  }
  const { attendanceBranchId, departmentId: requestedDepartmentId } = resolved;

  const departmentId = await coalesceSessionDepartmentFromProfile(
    userId,
    companyId,
    attendanceBranchId,
    requestedDepartmentId
  );

  if (!options?.manual) {
    if (
      !isFiniteNumber(input.latitude) ||
      !isFiniteNumber(input.longitude) ||
      !isValidLatitude(input.latitude) ||
      !isValidLongitude(input.longitude)
    ) {
      return { data: null, error: "Location permission is required" };
    }
    const branch = await branchesRepo.findById(attendanceBranchId);
    if (!branch || branch.company_id !== companyId) {
      return { data: null, error: EMPLOYEE_MSG_OFFICE_LOCATION_VERIFY_FAILED };
    }
    const geo = checkBranchGeofence(
      branch,
      input.latitude,
      input.longitude,
      "clock_in"
    );
    if (!geo.ok) {
      return { data: null, error: geo.error };
    }
  }

  const checkIn = nowIso();
  const shiftInfo = await getShiftInfoForClockIn(userId, companyId, checkIn);
  const latenessTracking = await companyPolicyService.isLatenessTrackingEnabled(companyId);
  const lateMinutesStored = latenessTracking ? shiftInfo.lateMinutes : 0;

  const businessTz = await getCompanyBusinessTimeZone(companyId);
  const policy = await companyPolicyService.getPolicy(companyId);
  const windowCtx = resolveWindowAtCheckIn({
    checkInIso: checkIn,
    businessTimeZone: businessTz,
    overnightShiftsEnabled: policy.overnight_shifts_enabled === true,
    shift: shiftInfo.shiftEntity
      ? toShiftWindowSource(shiftInfo.shiftEntity)
      : null,
  });

  try {
    const session = await repo.createSession({
      user_id: userId,
      company_id: companyId,
      check_in: checkIn,
      status: WorkSessionStatus.ACTIVE,
      branch_id: attendanceBranchId,
      ...(departmentId ? { department_id: departmentId } : {}),
      shift_id: shiftInfo.shiftId,
      late_minutes: lateMinutesStored,
      attendance_date: windowCtx.attendanceDateYmd,
      ...(options?.manual && options.manualAttendance
        ? {
            manual_check_in: true,
            manual_check_in_reason: options.manualAttendance.reason,
            manual_check_in_note: options.manualAttendance.note,
            manual_check_in_by: options.manualAttendance.actorUserId,
          }
        : {}),
    });

    return { data: session };
  } catch (err) {
    if (isPostgresUniqueViolation(err)) {
      return {
        data: null,
        error: "You already have an active clock-in session",
      };
    }
    throw err;
  }
}

export async function clockOut(
  userId: string,
  companyId: string,
  latitude?: number,
  longitude?: number
): Promise<ServiceResult<repo.WorkSessionRecord>> {
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    !isValidLatitude(latitude) ||
    !isValidLongitude(longitude)
  ) {
    return { data: null, error: "Location verification failed" };
  }

  const existing = await repo.findOpenSessionByUser(userId, companyId);
  if (!existing || !existing.check_in) {
    return { data: null, error: "No active session found" };
  }

  const branch = await resolveBranchForOpenSession(existing, companyId, userId);
  if (!branch) {
    return { data: null, error: "Location verification failed" };
  }

  const geo = checkBranchGeofence(branch, latitude, longitude, "clock_out");
  if (!geo.ok) {
    return { data: null, error: geo.error };
  }

  const checkOut = nowIso();
  const totalHours = calculateTotalHours(existing.check_in, checkOut);
  const durationMs =
    new Date(checkOut).getTime() - new Date(existing.check_in).getTime();
  const durationMinutes = Math.floor(durationMs / 60000);

  const overtimeMinutes = await getOvertimeMinutes(
    existing.shift_id,
    companyId,
    existing.check_in,
    checkOut
  );

  const { earlyLeaveMinutes, halfDay } = await getEarlyLeaveAndHalfDay(
    existing.shift_id,
    companyId,
    existing.check_in,
    checkOut,
    durationMinutes
  );

  const updated = await repo.closeSession(existing.id, companyId, {
    check_out: checkOut,
    total_hours: totalHours,
    status: WorkSessionStatus.COMPLETED,
    duration_minutes: durationMinutes,
    shift_overtime_minutes: overtimeMinutes,
    early_leave_minutes: earlyLeaveMinutes,
    half_day: halfDay,
  });

  if (!updated) {
    return { data: null, error: "No active session found" };
  }

  const warnings = await runPostClockOutPayroll(
    updated,
    companyId,
    existing.check_in
  );

  return { data: updated, warnings };
}

export async function manualClockIn(
  targetUserId: string,
  companyId: string,
  input: ClockInInput,
  meta: ManualAttendanceMeta
): Promise<ServiceResult<repo.WorkSessionRecord>> {
  return clockIn(targetUserId, companyId, input, { manual: true, manualAttendance: meta });
}

export async function manualClockOut(
  targetUserId: string,
  companyId: string,
  meta: ManualAttendanceMeta
): Promise<ServiceResult<repo.WorkSessionRecord>> {
  const existing = await repo.findOpenSessionByUser(targetUserId, companyId);
  if (!existing || !existing.check_in) {
    return { data: null, error: "No active session" };
  }

  const checkOut = nowIso();
  const totalHours = calculateTotalHours(existing.check_in, checkOut);
  const durationMs =
    new Date(checkOut).getTime() - new Date(existing.check_in).getTime();
  const durationMinutes = Math.floor(durationMs / 60000);

  const overtimeMinutes = await getOvertimeMinutes(
    existing.shift_id,
    companyId,
    existing.check_in,
    checkOut
  );

  const { earlyLeaveMinutes, halfDay } = await getEarlyLeaveAndHalfDay(
    existing.shift_id,
    companyId,
    existing.check_in,
    checkOut,
    durationMinutes
  );

  const updated = await repo.closeSession(existing.id, companyId, {
    check_out: checkOut,
    total_hours: totalHours,
    status: WorkSessionStatus.COMPLETED,
    duration_minutes: durationMinutes,
    shift_overtime_minutes: overtimeMinutes,
    early_leave_minutes: earlyLeaveMinutes,
    half_day: halfDay,
    manual_check_out: true,
    manual_check_out_reason: meta.reason,
    manual_check_out_note: meta.note,
    manual_check_out_by: meta.actorUserId,
  });

  if (!updated) {
    return { data: null, error: "No active session" };
  }

  const warnings = await runPostClockOutPayroll(
    updated,
    companyId,
    existing.check_in
  );

  return { data: updated, warnings };
}

/**
 * Include any open session even when attendance_date is not "today" (overnight still active after midnight).
 * Matches web attendance overview which uses getActiveSessions alongside today filter.
 */
export function mergeOpenSessionIntoTodayRows(
  todayRows: repo.WorkSessionRecord[],
  open: repo.WorkSessionRecord | null
): repo.WorkSessionRecord[] {
  if (!open) return todayRows;
  if (todayRows.some((r) => r.id === open.id)) return todayRows;
  const merged = [...todayRows, open];
  merged.sort((a, b) => {
    const ta = a.check_in ? new Date(a.check_in).getTime() : 0;
    const tb = b.check_in ? new Date(b.check_in).getTime() : 0;
    return ta - tb;
  });
  return merged;
}

export async function getTodaySessionsForUser(
  userId: string,
  companyId: string
): Promise<repo.WorkSessionRecord[]> {
  const tz = await getCompanyBusinessTimeZone(companyId);
  const { startIso, endIso } = businessTodayUtcRange(new Date(), tz);
  const todayYmd = calendarYmdInTimeZone(new Date(), tz).iso;
  const todayRows = await repo.getSessionsForUserToday(
    userId,
    companyId,
    startIso,
    endIso,
    todayYmd
  );
  const open = await repo.findOpenSessionByUser(userId, companyId);
  if (!open?.check_in) return todayRows;
  const isOpen =
    open.status === WorkSessionStatus.ACTIVE ||
    open.check_out == null;
  if (!isOpen) return todayRows;
  return mergeOpenSessionIntoTodayRows(todayRows, open);
}

export async function getTodaySessionsForCompany(
  companyId: string,
  scopedUserIds?: string[] | null
): Promise<repo.WorkSessionRecord[]> {
  const tz = await getCompanyBusinessTimeZone(companyId);
  const { startIso, endIso } = businessTodayUtcRange(new Date(), tz);
  const todayYmd = calendarYmdInTimeZone(new Date(), tz).iso;
  return repo.getCompanySessionsToday(companyId, startIso, endIso, todayYmd, scopedUserIds);
}

function inclusiveEndYmdFromExclusiveEndIso(endIso: string): string {
  const d = new Date(endIso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** API row for history tables (branch attendance site + optional department + optional employee display). */
export interface SessionHistoryItem {
  id: string;
  user_id: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  duration_minutes: number | null;
  total_hours: number | null;
  branch_id: string | null;
  branch_name: string | null;
  department_id: string | null;
  department_name: string | null;
  employee_name?: string | null;
  employee_email?: string | null;
  manual_check_in?: boolean | null;
  manual_check_in_reason?: string | null;
  manual_check_out?: boolean | null;
  manual_check_out_reason?: string | null;
  /** V2 ownership day (YYYY-MM-DD); may differ from check-in calendar day for overnight. */
  attendance_date?: string | null;
  overnight_session?: boolean;
}

function minutesWorkedFallback(s: repo.WorkSessionRecord): number | null {
  if (typeof s.duration_minutes === "number") return s.duration_minutes;
  if (s.check_in && s.check_out) {
    return Math.floor(
      (new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000
    );
  }
  return null;
}

async function enrichSessions(
  rows: repo.WorkSessionRecord[],
  companyId: string,
  includeUserNames: boolean
): Promise<SessionHistoryItem[]> {
  const departmentIds = [
    ...new Set(rows.map((r) => r.department_id).filter(Boolean)),
  ] as string[];
  const departments = await Promise.all(
    departmentIds.map((id) =>
      departmentsRepo.findByIdAndCompanyId(id, companyId)
    )
  );
  const departmentNameMap = new Map<string, string>();
  departmentIds.forEach((id, i) => {
    const d = departments[i];
    if (d) departmentNameMap.set(id, d.name);
  });

  const userIds = includeUserNames
    ? [...new Set(rows.map((r) => r.user_id))]
    : [...new Set(rows.map((r) => r.user_id))];
  const users = await Promise.all(
    userIds.map((uid) => usersRepo.getUserById(uid))
  );
  const userMap = new Map<string, { name: string; email: string; branch_id: string }>();
  userIds.forEach((uid, i) => {
    const u = users[i];
    if (u) {
      const name =
        [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email;
      userMap.set(uid, { name, email: u.email, branch_id: u.branch_id });
    }
  });

  const branchIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.branch_id, userMap.get(r.user_id)?.branch_id])
        .filter(Boolean)
    ),
  ] as string[];
  const branchRecords = await branchesRepo.findByIds(branchIds);
  const branchName = new Map<string, string>();
  for (const [id, b] of branchRecords) {
    branchName.set(id, b.name);
  }

  return rows.map((s) => {
    const attendanceBranchId = s.branch_id ?? userMap.get(s.user_id)?.branch_id ?? null;
    return {
      id: s.id,
      user_id: s.user_id,
      check_in: s.check_in,
      check_out: s.check_out,
      status: s.status,
      duration_minutes: minutesWorkedFallback(s),
      total_hours: s.total_hours ?? null,
      branch_id: attendanceBranchId,
      branch_name: attendanceBranchId ? branchName.get(attendanceBranchId) ?? null : null,
      department_id: s.department_id ?? null,
      department_name: s.department_id
        ? departmentNameMap.get(s.department_id) ?? null
        : null,
      employee_name: includeUserNames
        ? userMap.get(s.user_id)?.name ?? null
        : undefined,
      employee_email: includeUserNames
        ? userMap.get(s.user_id)?.email ?? null
        : undefined,
      manual_check_in: s.manual_check_in ?? false,
      manual_check_in_reason: s.manual_check_in_reason ?? null,
      manual_check_out: s.manual_check_out ?? false,
      manual_check_out_reason: s.manual_check_out_reason ?? null,
      attendance_date: s.attendance_date
        ? String(s.attendance_date).slice(0, 10)
        : null,
      overnight_session: Boolean(
        s.attendance_date &&
          s.check_in &&
          String(s.attendance_date).slice(0, 10) !== s.check_in.slice(0, 10)
      ),
    };
  });
}

export async function getMySessionHistory(
  userId: string,
  companyId: string,
  page: number,
  limit: number,
  startIso?: string,
  endIso?: string
): Promise<{
  rows: SessionHistoryItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const offset = (page - 1) * limit;
  const startYmd = startIso?.slice(0, 10);
  const endYmd =
    startIso && endIso ? inclusiveEndYmdFromExclusiveEndIso(endIso) : undefined;
  const { rows, total } = await repo.listSessionsForUser(userId, companyId, {
    startIso,
    endIso,
    startYmd,
    endYmd,
    limit,
    offset,
  });
  const enriched = await enrichSessions(rows, companyId, false);
  return { rows: enriched, total, page, limit };
}

export async function getCompanySessionHistory(
  companyId: string,
  page: number,
  limit: number,
  options: {
    userId?: string;
    startIso?: string;
    endIso?: string;
    scopedUserIds?: string[] | null;
  }
): Promise<{
  rows: SessionHistoryItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const offset = (page - 1) * limit;
  const startYmd = options.startIso?.slice(0, 10);
  const endYmd =
    options.startIso && options.endIso
      ? inclusiveEndYmdFromExclusiveEndIso(options.endIso)
      : undefined;
  const { rows, total } = await repo.listSessionsForCompany(companyId, {
    userId: options.userId,
    scopedUserIds: options.scopedUserIds,
    startIso: options.startIso,
    endIso: options.endIso,
    startYmd,
    endYmd,
    limit,
    offset,
  });
  const enriched = await enrichSessions(rows, companyId, true);
  return { rows: enriched, total, page, limit };
}

