import { WorkSessionStatus } from "../../constants/workSessionStatus";
import { ENV } from "../../config/env";
import {
  computeAbsenceMap,
  getDatesInRange,
  isRepeatedAbsence,
} from "./absenceAggregation";
import { aggregateLatenessByUser } from "./aggregateLateness";
import {
  aggregateSessionsForFlags,
  computeFlags,
  type AttendanceFlagLevel,
} from "./attendanceFlags";
import * as repo from "./attendance.repository";
import type { ScopedUserIds } from "./attendance.repository";
import * as leaveRepo from "../leave/leave.repository";
import * as usersRepo from "../users/users.repository";
import * as shiftsRepo from "../shifts/shifts.repository";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";
import { shiftRowActive } from "../shifts/shifts.service";
import {
  resolveShiftWindow,
  shouldMarkAbsentNow,
  toShiftWindowSource,
} from "../../lib/shiftWindow";
import {
  businessMonthStartUtcIso,
  businessTodayUtcRange,
  businessWeekStartUtcIso,
  calendarYmdInTimeZone,
  normalizeBusinessTimeZone,
} from "../../lib/businessCalendar";

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
}

function toIso(d: Date): string {
  return d.toISOString();
}

async function resolveUserShift(
  userId: string,
  companyId: string,
  defaultShift: shiftsRepo.ShiftRecord | null
): Promise<shiftsRepo.ShiftRecord | null> {
  const user = await usersRepo.getUserById(userId);
  if (user?.shift_id) {
    const s = await shiftsRepo.getShiftById(user.shift_id, companyId);
    if (s && shiftRowActive(s)) return s;
  }
  if (defaultShift && shiftRowActive(defaultShift)) return defaultShift;
  return null;
}

export async function getTodayOverview(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<ServiceResult<{
  present: number;
  active: number;
  completed: number;
  total_minutes_today: number;
  late_today: number;
  overtime_today: number;
  absent_today: number;
}>> {
  const policy = await companyPolicyService.getPolicy(companyId);
  const businessTz = normalizeBusinessTimeZone(policy.business_timezone);
  const overnightOn = policy.overnight_shifts_enabled === true;
  const nowIso = toIso(new Date());

  const sessions = await repo.getTodaySessions(companyId, scopedUserIds, businessTz);
  const activeSessions = await repo.getActiveSessions(companyId, scopedUserIds);
  const activeUserIds = new Set(activeSessions.map((s) => s.user_id));

  const userIds = new Set<string>();
  let active = 0;
  let completed = 0;
  let totalMinutes = 0;
  let lateToday = 0;
  let overtimeToday = 0;

  for (const s of sessions) {
    if (s.user_id) {
      userIds.add(s.user_id);
    }
    if (s.status === WorkSessionStatus.ACTIVE) active += 1;
    if (s.status === WorkSessionStatus.COMPLETED) completed += 1;
    if (typeof s.duration_minutes === "number") {
      totalMinutes += s.duration_minutes;
    }
    if (typeof s.late_minutes === "number" && s.late_minutes > 0) {
      lateToday += 1;
    }
    if (typeof s.shift_overtime_minutes === "number" && s.shift_overtime_minutes > 0) {
      overtimeToday += 1;
    }
  }

  const usersWithoutSessionToday = await repo.getUsersWithoutSessionToday(
    companyId,
    scopedUserIds,
    businessTz
  );
  const todayDate = calendarYmdInTimeZone(new Date(), businessTz).iso;
  let approvedLeavesToday = await leaveRepo.getApprovedLeavesForToday(
    companyId,
    todayDate
  );
  if (scopedUserIds !== undefined) {
    const allow = new Set(scopedUserIds);
    approvedLeavesToday = approvedLeavesToday.filter((l) => allow.has(l.user_id));
  }
  const onLeaveUserIds = new Set(approvedLeavesToday.map((l) => l.user_id));
  const notOnLeave = usersWithoutSessionToday.filter(
    (id) => !onLeaveUserIds.has(id) && !activeUserIds.has(id)
  );

  let absentCount = 0;
  const defaultShifts = await shiftsRepo.getShifts(companyId);
  const defaultShift =
    defaultShifts && defaultShifts.length > 0
      ? defaultShifts.find(shiftRowActive) ?? defaultShifts[0]
      : null;

  for (const userId of notOnLeave) {
    const shift = await resolveUserShift(userId, companyId, defaultShift);
    if (!shift) continue;

    const window = resolveShiftWindow({
      anchorIso: nowIso,
      businessTimeZone: businessTz,
      overnightShiftsEnabled: overnightOn,
      shift: toShiftWindowSource(shift),
    });

    if (shouldMarkAbsentNow(window, nowIso, businessTz)) {
      absentCount += 1;
    }
  }

  const absentToday = absentCount;

  return {
    data: {
      present: userIds.size,
      active,
      completed,
      total_minutes_today: totalMinutes,
      late_today: lateToday,
      overtime_today: overtimeToday,
      absent_today: absentToday,
    },
  };
}

export async function getMyAttendance(
  userId: string,
  companyId: string
): Promise<ServiceResult<{
  today_minutes: number;
  week_minutes: number;
  month_minutes: number;
}>> {
  const policy = await companyPolicyService.getPolicy(companyId);
  const businessTz = policy.business_timezone;
  const now = new Date();

  const { rows: sessions } = await repo.getUserSessions(userId, companyId);

  const todayStart = new Date(businessTodayUtcRange(now, businessTz).startIso);
  const weekStart = new Date(businessWeekStartUtcIso(now, businessTz));
  const monthStart = new Date(businessMonthStartUtcIso(now, businessTz));

  let todayMinutes = 0;
  let weekMinutes = 0;
  let monthMinutes = 0;

  for (const s of sessions) {
    if (!s.check_in || typeof s.duration_minutes !== "number") continue;

    const checkInDate = new Date(s.check_in);

    if (checkInDate >= todayStart) {
      todayMinutes += s.duration_minutes;
    }
    if (checkInDate >= weekStart) {
      weekMinutes += s.duration_minutes;
    }
    if (checkInDate >= monthStart) {
      monthMinutes += s.duration_minutes;
    }
  }

  return {
    data: {
      today_minutes: todayMinutes,
      week_minutes: weekMinutes,
      month_minutes: monthMinutes,
    },
  };
}

export async function getMonthlyStats(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<ServiceResult<{
  total_sessions: number;
  total_minutes: number;
  average_minutes_per_day: number;
}>> {
  const policy = await companyPolicyService.getPolicy(companyId);
  const sessions = await repo.getMonthSessions(companyId, scopedUserIds, policy.business_timezone);

  let totalSessions = 0;
  let totalMinutes = 0;
  const daysWithSessions = new Set<string>(); // YYYY-MM-DD

  for (const s of sessions) {
    totalSessions += 1;
    if (typeof s.duration_minutes === "number") {
      totalMinutes += s.duration_minutes;
    }
    if (s.check_in) {
      const dayKey = calendarYmdInTimeZone(new Date(s.check_in), policy.business_timezone).iso;
      daysWithSessions.add(dayKey);
    }
  }

  const dayCount = daysWithSessions.size || 1;
  const averagePerDay = totalMinutes / dayCount;

  return {
    data: {
      total_sessions: totalSessions,
      total_minutes: totalMinutes,
      average_minutes_per_day: Math.round(averagePerDay),
    },
  };
}

export async function getUserHistory(
  userId: string,
  companyId: string,
  page: number,
  limit: number
): Promise<ServiceResult<{
  sessions: Array<{
    date: string;
    check_in: string | null;
    check_out: string | null;
    duration_minutes: number | null;
    early_leave_minutes: number | null;
    half_day: boolean | null;
  }>;
  page: number;
  limit: number;
  total: number;
}>> {
  const offset = (page - 1) * limit;

  const { rows, total } = await repo.getUserSessions(
    userId,
    companyId,
    limit,
    offset
  );

  const history = rows.map(s => ({
    date: s.check_in
      ? toIso(new Date(s.check_in)).slice(0, 10)
      : "",
    check_in: s.check_in,
    check_out: s.check_out,
    duration_minutes: s.duration_minutes,
    early_leave_minutes: s.early_leave_minutes ?? null,
    half_day: s.half_day ?? null,
  }));

  return {
    data: {
      sessions: history,
      page,
      limit,
      total,
    },
  };
}

export async function getActiveEmployees(
  companyId: string,
  scopedUserIds?: ScopedUserIds
): Promise<ServiceResult<{
  active_count: number;
  active_sessions: Array<{
    user_id: string;
    check_in: string | null;
    department_id?: string | null;
  }>;
}>> {
  const sessions = await repo.getActiveSessions(companyId, scopedUserIds);

  return {
    data: {
      active_count: sessions.length,
      active_sessions: sessions,
    },
  };
}

export interface LatenessSummaryEmployee {
  user_id: string;
  name: string;
  late_count: number;
  average_late_minutes: number;
  total_late_minutes: number;
  repeated_late: boolean;
  latest_late_at: string | null;
}

export async function getLatenessSummary(
  companyId: string,
  startDate: string,
  endDate: string,
  scopedUserIds?: ScopedUserIds
): Promise<ServiceResult<{
  period: { start: string; end: string };
  summary: {
    totalLateIncidents: number;
    repeatedLateEmployees: number;
  };
  employees: LatenessSummaryEmployee[];
}>> {
  const startIso = `${startDate}T00:00:00.000Z`;
  const endDay = new Date(endDate + "T00:00:00.000Z");
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const endIso = endDay.toISOString();

  const rows = await repo.getSessionsWithLatenessInRange(
    companyId,
    startIso,
    endIso
  );

  const threshold = ENV.REPEATED_LATE_THRESHOLD;
  const { totalLateIncidents, repeatedLateCount, byUser } =
    aggregateLatenessByUser(rows, threshold);

  const userIds = [...byUser.keys()];
  const employees: LatenessSummaryEmployee[] = [];

  for (const uid of userIds) {
    const stat = byUser.get(uid)!;
    const user = await usersRepo.findByIdAndCompanyId(uid, companyId);
    const name = user
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—"
      : "—";
    const averageLate =
      stat.late_count > 0
        ? Math.round((stat.total_late_minutes / stat.late_count) * 100) / 100
        : 0;
    employees.push({
      user_id: uid,
      name,
      late_count: stat.late_count,
      average_late_minutes: averageLate,
      total_late_minutes: stat.total_late_minutes,
      repeated_late: stat.late_count >= threshold,
      latest_late_at: stat.latest_check_in,
    });
  }

  return {
    data: {
      period: { start: startDate, end: endDate },
      summary: {
        totalLateIncidents,
        repeatedLateEmployees: repeatedLateCount,
      },
      employees,
    },
  };
}

export interface FlagsSummaryEmployee {
  user_id: string;
  name: string;
  late_count: number;
  total_late_minutes: number;
  average_late_minutes: number;
  early_leave_count: number;
  total_early_leave_minutes: number;
  half_day_count: number;
  repeated_late: boolean;
  repeated_early_leave: boolean;
  frequent_half_day: boolean;
  attention_needed: boolean;
  attendance_flag_level: AttendanceFlagLevel;
}

export async function getFlagsSummary(
  companyId: string,
  startDate: string,
  endDate: string,
  scopedUserIds?: ScopedUserIds
): Promise<ServiceResult<{
  period: { start: string; end: string };
  summary: { employeesFlagged: number; highRiskEmployees: number };
  employees: FlagsSummaryEmployee[];
}>> {
  const startIso = `${startDate}T00:00:00.000Z`;
  const endDay = new Date(endDate + "T00:00:00.000Z");
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const endIso = endDay.toISOString();

  const rows = await repo.getSessionsInDateRangeForFlags(
    companyId,
    startIso,
    endIso,
    scopedUserIds
  );

  const byUser = aggregateSessionsForFlags(rows);
  const thresholds = {
    repeatedLate: ENV.REPEATED_LATE_THRESHOLD,
    repeatedEarlyLeave: ENV.REPEATED_EARLY_LEAVE_THRESHOLD,
    frequentHalfDay: ENV.FREQUENT_HALF_DAY_THRESHOLD,
  };

  const employees: FlagsSummaryEmployee[] = [];
  for (const [uid, stats] of byUser.entries()) {
    const user = await usersRepo.findByIdAndCompanyId(uid, companyId);
    const name = user
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—"
      : "—";
    const averageLate =
      stats.late_count > 0
        ? Math.round((stats.total_late_minutes / stats.late_count) * 100) / 100
        : 0;
    const flags = computeFlags(stats, thresholds);
    employees.push({
      user_id: uid,
      name,
      late_count: stats.late_count,
      total_late_minutes: stats.total_late_minutes,
      average_late_minutes: averageLate,
      early_leave_count: stats.early_leave_count,
      total_early_leave_minutes: stats.total_early_leave_minutes,
      half_day_count: stats.half_day_count,
      repeated_late: flags.repeated_late,
      repeated_early_leave: flags.repeated_early_leave,
      frequent_half_day: flags.frequent_half_day,
      attention_needed: flags.attention_needed,
      attendance_flag_level: flags.attendance_flag_level,
    });
  }

  const employeesFlagged = employees.filter(e => e.attention_needed).length;
  const highRiskEmployees = employees.filter(
    e => e.attendance_flag_level === "high"
  ).length;

  return {
    data: {
      period: { start: startDate, end: endDate },
      summary: { employeesFlagged, highRiskEmployees },
      employees,
    },
  };
}

export interface AbsenceSummaryEmployee {
  user_id: string;
  name: string;
  absence_count: number;
  absence_dates: string[];
  repeated_absence: boolean;
}

export async function getAbsenceSummary(
  companyId: string,
  startDate: string,
  endDate: string,
  listBranchId?: string
): Promise<ServiceResult<{
  period: { start: string; end: string };
  summary: { totalAbsenceIncidents: number; employeesWithAbsences: number };
  employees: AbsenceSummaryEmployee[];
}>> {
  const startIso = `${startDate}T00:00:00.000Z`;
  const endDay = new Date(endDate + "T00:00:00.000Z");
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const endIso = endDay.toISOString();

  const activeUsers = await usersRepo.findAllByCompanyId(companyId, listBranchId);
  const scopedUserIdsForSessions: ScopedUserIds =
    listBranchId !== undefined ? activeUsers.map((u) => u.id) : undefined;

  const [shifts, sessionRows, approvedLeavesRaw] = await Promise.all([
    shiftsRepo.getShifts(companyId),
    repo.getCompletedSessionUserDatesInRange(
      companyId,
      startIso,
      endIso,
      scopedUserIdsForSessions
    ),
    leaveRepo.getApprovedLeavesInRange(companyId, startDate, endDate),
  ]);

  const allowedUserSet =
    listBranchId !== undefined ? new Set(activeUsers.map((u) => u.id)) : null;
  const approvedLeaves =
    allowedUserSet === null
      ? approvedLeavesRaw
      : approvedLeavesRaw.filter((l) => allowedUserSet!.has(l.user_id));

  const expectedUserIds = new Set<string>();
  if (shifts && shifts.length > 0) {
    for (const u of activeUsers) {
      const hasShift =
        u.shift_id && shifts.some(s => s.id === u.shift_id);
      const hasDefault = shifts.length > 0;
      if (hasShift || hasDefault) expectedUserIds.add(u.id);
    }
  }

  const sessionSet = new Set<string>();
  for (const r of sessionRows) {
    sessionSet.add(`${r.user_id}_${r.date}`);
  }

  const leaveSet = new Set<string>();
  for (const leave of approvedLeaves) {
    const leaveStart =
      leave.start_date > startDate ? leave.start_date : startDate;
    const leaveEnd = leave.end_date < endDate ? leave.end_date : endDate;
    const leaveDates = getDatesInRange(leaveStart, leaveEnd);
    for (const d of leaveDates) {
      leaveSet.add(`${leave.user_id}_${d}`);
    }
  }

  const datesInRange = getDatesInRange(startDate, endDate);
  const absenceByUser = computeAbsenceMap(
    expectedUserIds,
    datesInRange,
    sessionSet,
    leaveSet
  );

  const employees: AbsenceSummaryEmployee[] = [];
  const threshold = ENV.REPEATED_ABSENCE_THRESHOLD;

  for (const [uid, dates] of absenceByUser.entries()) {
    if (dates.length === 0) continue;
    const user = await usersRepo.findByIdAndCompanyId(uid, companyId);
    const name = user
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—"
      : "—";
    employees.push({
      user_id: uid,
      name,
      absence_count: dates.length,
      absence_dates: dates,
      repeated_absence: isRepeatedAbsence(dates.length, threshold),
    });
  }

  let totalAbsenceIncidents = 0;
  for (const d of absenceByUser.values()) {
    totalAbsenceIncidents += d.length;
  }

  return {
    data: {
      period: { start: startDate, end: endDate },
      summary: {
        totalAbsenceIncidents,
        employeesWithAbsences: employees.length,
      },
      employees,
    },
  };
}

