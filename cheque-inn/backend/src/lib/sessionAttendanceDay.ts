import { salaryAttendanceDayFromCheckIn } from "../modules/payroll/salaryEarnings.engine";

export { salaryAttendanceDayFromCheckIn as legacyPayrollDayFromCheckInUtc };

/**
 * Payroll / reporting bucket key for a session.
 * Prefer persisted `attendance_date`; fall back to v1 UTC slice of `check_in`.
 */
export function sessionAttendanceDayForPayroll(session: {
  attendance_date?: string | null;
  check_in?: string | null;
}): string | null {
  if (session.attendance_date) {
    return session.attendance_date.slice(0, 10);
  }
  if (!session.check_in) return null;
  return salaryAttendanceDayFromCheckIn(session.check_in);
}
