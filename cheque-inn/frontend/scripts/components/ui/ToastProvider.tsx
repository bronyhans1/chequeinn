"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "warning";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 2800;

function toastColors(kind: ToastKind): { bg: string; border: string; text: string } {
  if (kind === "success") {
    return {
      bg: "color-mix(in srgb, #16a34a 16%, var(--surface))",
      border: "color-mix(in srgb, #16a34a 55%, var(--border-soft))",
      text: "var(--text-primary)",
    };
  }
  if (kind === "warning") {
    return {
      bg: "color-mix(in srgb, #d97706 14%, var(--surface))",
      border: "color-mix(in srgb, #d97706 48%, var(--border-soft))",
      text: "var(--text-primary)",
    };
  }
  return {
    bg: "color-mix(in srgb, #dc2626 14%, var(--surface))",
    border: "color-mix(in srgb, #dc2626 52%, var(--border-soft))",
    text: "var(--text-primary)",
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      warning: (message: string) => push("warning", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const colors = toastColors(toast.kind);
          return (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur-[2px]"
              style={{
                background: colors.bg,
                borderColor: colors.border,
                color: colors.text,
                animation: "toast-enter 180ms ease-out",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
