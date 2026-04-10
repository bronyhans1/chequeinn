/** Mirrors backend `MANUAL_ATTENDANCE_REASON_CODES` for web forms. */
export const MANUAL_ATTENDANCE_REASONS: Array<{ code: string; label: string }> = [
  { code: "phone_unavailable", label: "Phone unavailable" },
  { code: "device_battery_dead", label: "Device battery dead" },
  { code: "app_or_network_issue", label: "App or network issue" },
  { code: "missed_scan", label: "Missed scan" },
  { code: "supervisor_override", label: "Supervisor override" },
  { code: "other", label: "Other" },
];

export type ManualAttendanceReasonCode = (typeof MANUAL_ATTENDANCE_REASONS)[number]["code"];
