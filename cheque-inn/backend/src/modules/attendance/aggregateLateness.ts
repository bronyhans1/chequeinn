/**
 * Pure aggregation of lateness rows by user. Used by getLatenessSummary.
 */
export interface LatenessRow {
  user_id: string;
  check_in: string | null;
  late_minutes: number | null;
}

export interface UserLatenessStat {
  late_count: number;
  total_late_minutes: number;
  latest_check_in: string | null;
}

export function aggregateLatenessByUser(
  rows: LatenessRow[],
  threshold: number
): {
  totalLateIncidents: number;
  repeatedLateCount: number;
  byUser: Map<string, UserLatenessStat>;
} {
  /** Per user, per check-in calendar day: earliest session's late minutes + that check-in for latest tracking */
  const latePick = new Map<string, Map<string, { ms: number; late: number; check_in: string | null }>>();
  let noCheckInSeq = 0;

  for (const r of rows) {
    if (!r.user_id) continue;
    const lateMinutes = typeof r.late_minutes === "number" && r.late_minutes > 0 ? r.late_minutes : 0;
    if (lateMinutes <= 0) continue;
    const day =
      r.check_in && r.check_in.length >= 10 ? r.check_in.slice(0, 10) : `__no_checkin_${noCheckInSeq++}`;
    const ms = r.check_in ? new Date(r.check_in).getTime() : Number.MAX_SAFE_INTEGER;
    if (!latePick.has(r.user_id)) latePick.set(r.user_id, new Map());
    const dm = latePick.get(r.user_id)!;
    const prev = dm.get(day);
    if (!prev || ms < prev.ms) dm.set(day, { ms, late: lateMinutes, check_in: r.check_in });
  }

  const byUser = new Map<string, UserLatenessStat>();

  for (const [userId, dm] of latePick) {
    let totalLate = 0;
    let latest: string | null = null;
    for (const { late, check_in } of dm.values()) {
      totalLate += late;
      if (check_in && (!latest || check_in > latest)) latest = check_in;
    }
    byUser.set(userId, {
      late_count: dm.size,
      total_late_minutes: totalLate,
      latest_check_in: latest,
    });
  }

  let repeatedLateCount = 0;
  let totalLateIncidents = 0;
  for (const stat of byUser.values()) {
    totalLateIncidents += stat.late_count;
    if (stat.late_count >= threshold) repeatedLateCount += 1;
  }

  return {
    totalLateIncidents,
    repeatedLateCount,
    byUser,
  };
}
