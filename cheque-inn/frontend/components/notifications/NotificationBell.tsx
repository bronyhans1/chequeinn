"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { isPlatformAdmin } from "@/lib/auth/roles";
import * as notificationsApi from "@/lib/api/notifications.api";
import { isApiError } from "@/lib/types/api";
import type { NotificationRow } from "@/lib/api/notifications.api";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const enabled = !!user && !isPlatformAdmin(user.roles);

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [countRes, listRes] = await Promise.all([
      notificationsApi.getUnreadCount(),
      notificationsApi.listMyNotifications({ page: 1, limit: 15 }),
    ]);
    if (!isApiError(countRes)) setUnread(countRes.data.unread);
    if (!isApiError(listRes)) setRows(listRes.data.rows);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !open) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [enabled, open, refresh]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!enabled) return null;

  async function handleMarkRead(id: string) {
    await notificationsApi.markNotificationRead(id);
    await refresh();
  }

  async function handleMarkAll() {
    await notificationsApi.markAllNotificationsRead();
    await refresh();
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 transition-colors hover:bg-[var(--nav-hover)]"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <svg
          className="h-5 w-5"
          style={{ color: "var(--text-primary)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-lg"
          style={{
            borderColor: "var(--border-soft)",
            background: "var(--surface)",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Notifications
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && rows.length === 0 ? (
              <p className="px-3 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                Loading…
              </p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                No notifications yet.
              </p>
            ) : (
              <ul>
                {rows.map((n) => (
                  <li
                    key={n.id}
                    className="border-b px-3 py-2.5 last:border-b-0"
                    style={{
                      borderColor: "var(--border-soft)",
                      background: n.read_at ? undefined : "var(--surface-muted)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {n.body}
                        </p>
                        <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {formatWhen(n.created_at)}
                        </p>
                      </div>
                      {!n.read_at ? (
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(n.id)}
                          className="shrink-0 text-[10px] font-medium text-primary-600 hover:underline"
                        >
                          Read
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
