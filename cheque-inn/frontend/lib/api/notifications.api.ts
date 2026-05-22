import { apiClient } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface NotificationListResult {
  rows: NotificationRow[];
  total: number;
  page: number;
  limit: number;
}

export async function listMyNotifications(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiResponse<NotificationListResult>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return apiClient.get<NotificationListResult>(
    `/api/notifications${q ? `?${q}` : ""}`
  );
}

export async function getUnreadCount(): Promise<ApiResponse<{ unread: number }>> {
  return apiClient.get<{ unread: number }>("/api/notifications/unread-count");
}

export async function markNotificationRead(
  id: string
): Promise<ApiResponse<NotificationRow>> {
  return apiClient.patch<NotificationRow>(`/api/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<
  ApiResponse<{ marked: number }>
> {
  return apiClient.post<{ marked: number }>("/api/notifications/mark-all-read", {});
}
