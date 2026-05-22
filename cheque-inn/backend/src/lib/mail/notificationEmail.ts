import type { NotificationRecord } from "../../modules/notifications/notifications.repository";

export function notificationEmailSubject(record: NotificationRecord): string {
  return `Cheque-Inn: ${record.title}`;
}

export function notificationEmailBody(record: NotificationRecord): string {
  return `${record.title}\n\n${record.body}\n\n— Cheque-Inn`;
}
