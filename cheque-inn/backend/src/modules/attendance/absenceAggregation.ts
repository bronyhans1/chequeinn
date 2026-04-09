/**
 * Pure helpers for absence summary: date range, absence map, repeated-absence flag.
 * Keys for sets: "userId_date" (e.g. "uuid_2026-03-01").
 */

export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T00:00:00.000Z");
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * For each expected user and each date, if (user, date) is not in sessionSet
 * and not in leaveSet, count as absence. Returns map of userId -> sorted list of absence dates.
 */
export function computeAbsenceMap(
  expectedUserIds: Set<string>,
  datesInRange: string[],
  sessionSet: Set<string>,
  leaveSet: Set<string>
): Map<string, string[]> {
  const absenceByUser = new Map<string, string[]>();
  for (const date of datesInRange) {
    for (const userId of expectedUserIds) {
      const key = `${userId}_${date}`;
      if (!sessionSet.has(key) && !leaveSet.has(key)) {
        const arr = absenceByUser.get(userId) ?? [];
        arr.push(date);
        absenceByUser.set(userId, arr);
      }
    }
  }
  for (const arr of absenceByUser.values()) {
    arr.sort();
  }
  return absenceByUser;
}

export function isRepeatedAbsence(
  absenceCount: number,
  threshold: number
): boolean {
  return absenceCount >= threshold;
}
