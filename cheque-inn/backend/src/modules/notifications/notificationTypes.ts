/** In-app notification categories (matches DB check constraint). */
export const NotificationType = {
  FORGOT_CLOCK_OUT: "forgot_clock_out",
  LEAVE_SUBMITTED: "leave_submitted",
  LEAVE_PENDING_REVIEW: "leave_pending_review",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  PAYROLL_SYNC_FAILURE: "payroll_sync_failure",
  PAYROLL_EXPORT_READY: "payroll_export_ready",
  PAYROLL_GENERATED: "payroll_generated",
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];
