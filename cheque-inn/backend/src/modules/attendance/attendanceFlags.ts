/**
 * Pure aggregation and flag computation for attendance flags summary.
 */

export interface FlagSessionRow {
  user_id: string;
  /** UTC check-in; used to dedupe lateness to one incident per calendar day (earliest session wins). */
  check_in: string | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  half_day: boolean | null;
}

export interface PerUserFlagStats {
  late_count: number;
  total_late_minutes: number;
  early_leave_count: number;
  total_early_leave_minutes: number;
  half_day_count: number;
}

export interface FlagThresholds {
  repeatedLate: number;
  repeatedEarlyLeave: number;
  frequentHalfDay: number;
}

export type AttendanceFlagLevel = "none" | "low" | "medium" | "high";

export interface ComputedFlags {
  repeated_late: boolean;
  repeated_early_leave: boolean;
  frequent_half_day: boolean;
  attention_needed: boolean;
  attendance_flag_level: AttendanceFlagLevel;
}

export function aggregateSessionsForFlags(
  rows: FlagSessionRow[]
): Map<string, PerUserFlagStats> {
  const byUser = new Map<string, PerUserFlagStats>();
  /** Per user, per attendance day (check-in date): keep earliest check-in's late minutes. */
  const latePick = new Map<string, Map<string, { ms: number; late: number }>>();
  let noCheckInSeq = 0;

  for (const r of rows) {
    if (!r.user_id) continue;

    const lateMinutes =
      typeof r.late_minutes === "number" && r.late_minutes > 0 ? r.late_minutes : 0;
    if (lateMinutes > 0) {
      const dayKey =
        r.check_in && r.check_in.length >= 10
          ? r.check_in.slice(0, 10)
          : `__no_checkin_${noCheckInSeq++}`;
      const ms = r.check_in ? new Date(r.check_in).getTime() : Number.MAX_SAFE_INTEGER;
      if (!latePick.has(r.user_id)) latePick.set(r.user_id, new Map());
      const dm = latePick.get(r.user_id)!;
      const prev = dm.get(dayKey);
      if (!prev || ms < prev.ms) dm.set(dayKey, { ms, late: lateMinutes });
    }

    const earlyMinutes =
      typeof r.early_leave_minutes === "number" && r.early_leave_minutes > 0
        ? r.early_leave_minutes
        : 0;
    const halfDay = r.half_day === true;

    const existing = byUser.get(r.user_id);
    if (!existing) {
      byUser.set(r.user_id, {
        late_count: 0,
        total_late_minutes: 0,
        early_leave_count: earlyMinutes > 0 ? 1 : 0,
        total_early_leave_minutes: earlyMinutes,
        half_day_count: halfDay ? 1 : 0,
      });
    } else {
      if (earlyMinutes > 0) {
        existing.early_leave_count += 1;
        existing.total_early_leave_minutes += earlyMinutes;
      }
      if (halfDay) existing.half_day_count += 1;
    }
  }

  for (const [userId, dm] of latePick) {
    const st = byUser.get(userId);
    if (!st) {
      let totalLate = 0;
      for (const { late } of dm.values()) totalLate += late;
      byUser.set(userId, {
        late_count: dm.size,
        total_late_minutes: totalLate,
        early_leave_count: 0,
        total_early_leave_minutes: 0,
        half_day_count: 0,
      });
    } else {
      st.late_count = dm.size;
      st.total_late_minutes = 0;
      for (const { late } of dm.values()) st.total_late_minutes += late;
    }
  }

  return byUser;
}

export function computeFlags(
  stats: PerUserFlagStats,
  thresholds: FlagThresholds
): ComputedFlags {
  const repeated_late = stats.late_count >= thresholds.repeatedLate;
  const repeated_early_leave = stats.early_leave_count >= thresholds.repeatedEarlyLeave;
  const frequent_half_day = stats.half_day_count >= thresholds.frequentHalfDay;
  const attention_needed = repeated_late || repeated_early_leave || frequent_half_day;

  const triggeredCount = [repeated_late, repeated_early_leave, frequent_half_day].filter(Boolean).length;
  const attendance_flag_level: AttendanceFlagLevel =
    triggeredCount === 0 ? "none"
    : triggeredCount === 1 ? "low"
    : triggeredCount === 2 ? "medium"
    : "high";

  return {
    repeated_late,
    repeated_early_leave,
    frequent_half_day,
    attention_needed,
    attendance_flag_level,
  };
}
