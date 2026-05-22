import * as repo from "./notifications.repository";

export async function listMyNotifications(
  companyId: string,
  userId: string,
  page: number,
  limit: number
) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * limit;
  return repo.listForUser(companyId, userId, limit, offset);
}

export async function getUnreadCount(companyId: string, userId: string) {
  return repo.countUnread(companyId, userId);
}

export async function markNotificationRead(
  companyId: string,
  userId: string,
  notificationId: string
) {
  return repo.markRead(notificationId, companyId, userId);
}

export async function markAllNotificationsRead(companyId: string, userId: string) {
  return repo.markAllRead(companyId, userId);
}
