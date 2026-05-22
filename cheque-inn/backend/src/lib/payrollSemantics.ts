/**
 * Payroll read/export semantics — no formula changes.
 * salary_daily rows store hours/minutes as 0 in DB; display/export use explicit N/A labels.
 */

export const PAYROLL_RECORD_TYPE_SALARY_DAILY = "salary_daily";
export const PAYROLL_RECORD_TYPE_SESSION_HOURLY = "session_hourly";

export function isSalaryDailyPayrollRecord(recordType?: string | null): boolean {
  return recordType === PAYROLL_RECORD_TYPE_SALARY_DAILY;
}

export function payrollRecordTypeLabel(recordType?: string | null): string {
  if (isSalaryDailyPayrollRecord(recordType)) return "Monthly Day Credit";
  if (recordType === PAYROLL_RECORD_TYPE_SESSION_HOURLY || !recordType) return "Hourly Session";
  return recordType ?? "Unknown";
}

const SALARY_NA = "N/A (salary-based)";

export function exportHoursWorkedDisplay(record: {
  record_type?: string | null;
  hours_worked?: number | null;
}): string {
  if (isSalaryDailyPayrollRecord(record.record_type)) return SALARY_NA;
  return String(record.hours_worked ?? 0);
}

export function exportRegularMinutesDisplay(record: {
  record_type?: string | null;
  regular_minutes?: number | null;
}): string {
  if (isSalaryDailyPayrollRecord(record.record_type)) return SALARY_NA;
  return String(record.regular_minutes ?? 0);
}

export function exportOvertimeMinutesDisplay(record: {
  record_type?: string | null;
  overtime_minutes?: number | null;
}): string {
  if (isSalaryDailyPayrollRecord(record.record_type)) return SALARY_NA;
  return String(record.overtime_minutes ?? 0);
}

/** Attendance ownership day for exports (salary_daily uses earnings_date). */
export function exportAttendanceDayDisplay(record: {
  record_type?: string | null;
  earnings_date?: string | null;
  payroll_date?: string | null;
}): string {
  if (isSalaryDailyPayrollRecord(record.record_type)) {
    const d = record.earnings_date ?? record.payroll_date;
    return d ? String(d).slice(0, 10) : "";
  }
  return record.payroll_date ? String(record.payroll_date).slice(0, 10) : "";
}

export function exportHourlyRateLabel(record: {
  record_type?: string | null;
  hourly_rate?: number | null;
}): { value: number | null; headerHint: string } {
  if (isSalaryDailyPayrollRecord(record.record_type)) {
    return { value: record.hourly_rate ?? null, headerHint: "Daily rate" };
  }
  return { value: record.hourly_rate ?? null, headerHint: "Hourly rate" };
}
