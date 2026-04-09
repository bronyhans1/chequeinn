const DATE_RANGE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

export function parseAndValidateDateRange(
  startStr: string | undefined,
  endStr: string | undefined
): { start: string; end: string } | { error: string } {
  if (
    typeof startStr !== "string" ||
    typeof endStr !== "string" ||
    !DATE_RANGE_REGEX.test(startStr) ||
    !DATE_RANGE_REGEX.test(endStr)
  ) {
    return { error: "start and end are required as YYYY-MM-DD" };
  }
  const start = new Date(startStr + "T00:00:00.000Z");
  const end = new Date(endStr + "T00:00:00.000Z");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Invalid date format for start or end" };
  }
  if (start > end) {
    return { error: "start must be before or equal to end" };
  }
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysDiff > MAX_RANGE_DAYS) {
    return { error: "Date range must not exceed 366 days" };
  }
  return { start: startStr, end: endStr };
}
