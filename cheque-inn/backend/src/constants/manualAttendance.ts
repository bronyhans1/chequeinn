/**
 * Manual attendance override — reason codes stored on work_sessions and audit metadata.
 */
export const MANUAL_ATTENDANCE_REASON_CODES = [
  "phone_unavailable",
  "device_battery_dead",
  "app_or_network_issue",
  "missed_scan",
  "supervisor_override",
  "other",
] as const;

export type ManualAttendanceReasonCode = (typeof MANUAL_ATTENDANCE_REASON_CODES)[number];

export function isValidManualReasonCode(value: string): value is ManualAttendanceReasonCode {
  return (MANUAL_ATTENDANCE_REASON_CODES as readonly string[]).includes(value);
}
