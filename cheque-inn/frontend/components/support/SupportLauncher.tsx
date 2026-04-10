"use client";

import { useEffect, useMemo, useState } from "react";
import * as platformApi from "@/lib/api/platform.api";
import { isApiError } from "@/lib/types/api";

function IconHeadset({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 12a8 8 0 0 1 16 0v5a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 13v2.5A2.5 2.5 0 0 0 6.5 18H7a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 7 12H6.5A2.5 2.5 0 0 0 4 14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 13v2.5A2.5 2.5 0 0 1 17.5 18H17a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 17 12h.5A2.5 2.5 0 0 1 20 14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalizeTel(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function IconEmail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 7.5h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m5.5 8.5 6.5 5 6.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPhone({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.2 5.6c.3-.6.9-1 1.6-1h1.2c.6 0 1.2.4 1.4 1l.9 2.6c.2.6 0 1.2-.5 1.6l-1.2.9c1 2 2.6 3.6 4.6 4.6l.9-1.2c.4-.5 1-.7 1.6-.5l2.6.9c.6.2 1 .8 1 1.4v1.2c0 .7-.4 1.3-1 1.6-.8.4-1.7.6-2.6.5-8.1-.7-14.4-7-15.1-15.1-.1-.9.1-1.8.5-2.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWhatsApp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 11.7A8.2 8.2 0 0 1 7.6 18.9L4.6 19.4l.7-2.9A8.2 8.2 0 1 1 20 11.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 9.3c.2-.4.5-.4.8-.3.2.1.6.2.7.5l.7 1.5c.1.3.1.5-.1.7l-.5.6c.6 1 1.5 1.9 2.5 2.5l.6-.5c.2-.2.4-.2.7-.1l1.5.7c.3.1.4.5.5.7.1.3.1.6-.3.8-.4.2-1.2.5-2.2.2-1.4-.5-2.7-1.3-3.8-2.4-1.1-1.1-1.9-2.4-2.4-3.8-.3-1 0-1.8.2-2.2Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function SupportLauncher() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<platformApi.PlatformSupportSettings | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await platformApi.getSupportSettings();
        if (cancelled) return;
        if (isApiError(res)) {
          setError(res.error ?? "Failed to load support details");
          setData(null);
          return;
        }
        setData(res.data ?? null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load support details");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const email = data?.support_email?.trim() || "";
    const phone = data?.support_phone?.trim() || "";
    const wa = data?.support_whatsapp_url?.trim() || "";
    return {
      email,
      phone,
      whatsapp: wa,
      hasAny: !!(email || phone || wa),
    };
  }, [data]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-md transition-colors duration-150 hover:bg-[var(--nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--surface)",
          color: "var(--text-primary)",
        }}
        aria-label="Contact support"
        aria-expanded={open}
      >
        <IconHeadset className="h-4 w-4" />
        Support
      </button>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default"
          aria-label="Close support panel"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={`fixed bottom-20 right-5 z-50 w-[320px] max-w-[calc(100vw-2.5rem)] origin-bottom-right transition-all duration-150 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <div
          className="rounded-2xl border p-3 shadow-xl"
          style={{
            borderColor: "var(--border-soft)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-soft)",
          }}
          role="dialog"
          aria-label="Contact Support"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Contact Support
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150 hover:bg-[var(--nav-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              Close
            </button>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Loading support details…
            </p>
          ) : error ? (
            <div className="alert-error px-3 py-2">{error}</div>
          ) : !rows.hasAny ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Support details are not available yet.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.email ? (
                <a
                  href={`mailto:${rows.email}`}
                  className="group flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <IconEmail className="mt-0.5 h-5 w-5 text-primary-600 dark:text-primary-300" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Email</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-theme">{rows.email}</p>
                  </div>
                </a>
              ) : null}

              {rows.phone ? (
                <a
                  href={`tel:${normalizeTel(rows.phone)}`}
                  className="group flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <IconPhone className="mt-0.5 h-5 w-5 text-primary-600 dark:text-primary-300" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Phone</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-theme">{rows.phone}</p>
                  </div>
                </a>
              ) : null}

              {rows.whatsapp ? (
                <a
                  href={rows.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <IconWhatsApp className="mt-0.5 h-5 w-5 text-primary-600 dark:text-primary-300" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">WhatsApp</p>
                    <p className="mt-0.5 text-sm font-medium text-theme">Chat on WhatsApp</p>
                  </div>
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

