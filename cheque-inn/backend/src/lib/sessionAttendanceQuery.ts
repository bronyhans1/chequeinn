/**
 * PostgREST filters: prefer `attendance_date` for ownership day; fall back to `check_in` when null.
 */

export function postgrestOrFilterForAttendanceDayInRange(params: {
  startYmd: string;
  endYmd: string;
  startIso: string;
  endIso: string;
}): string {
  const { startYmd, endYmd, startIso, endIso } = params;
  return [
    `and(attendance_date.gte.${startYmd},attendance_date.lte.${endYmd})`,
    `and(attendance_date.is.null,check_in.gte.${startIso},check_in.lt.${endIso})`,
  ].join(",");
}

/** Single business calendar day (inclusive) by ownership date or legacy check-in window. */
export function postgrestOrFilterForAttendanceOnBusinessDay(params: {
  todayYmd: string;
  startIso: string;
  endIso: string;
}): string {
  const { todayYmd, startIso, endIso } = params;
  return [
    `attendance_date.eq.${todayYmd}`,
    `and(attendance_date.is.null,check_in.gte.${startIso},check_in.lt.${endIso})`,
  ].join(",");
}
