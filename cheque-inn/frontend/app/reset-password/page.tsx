"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/lib/branding";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDefaultHomeRoute } from "@/lib/auth/roles";

const MIN_PASSWORD = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      router.replace(getDefaultHomeRoute(user.roles));
    }
  }, [user, authLoading, router]);

  const markSessionReady = useCallback(() => {
    setSessionReady(true);
    setInitializing(false);
    setInitError(null);
  }, []);

  const markInitFailed = useCallback((message: string) => {
    setSessionReady(false);
    setInitializing(false);
    setInitError(message);
  }, []);

  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      markInitFailed("Password reset is not available: Supabase is not configured.");
      return;
    }

    let cancelled = false;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const settleReady = () => {
      if (cancelled || settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      markSessionReady();
    };

    const settleError = (message: string) => {
      if (cancelled || settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      markInitFailed(message);
    };

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled || settled) return;
      if (
        session &&
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")
      ) {
        settleReady();
      }
    });

    void (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: codeErr } = await sb.auth.exchangeCodeForSession(code);
          if (codeErr) {
            settleError(codeErr.message);
            return;
          }
          window.history.replaceState({}, "", `${url.origin}${url.pathname}${url.hash}`);
        }

        const {
          data: { session },
        } = await sb.auth.getSession();
        if (cancelled) return;
        if (session) {
          settleReady();
          return;
        }

        timeoutId = setTimeout(async () => {
          if (cancelled || settled) return;
          const {
            data: { session: later },
          } = await sb.auth.getSession();
          if (later) settleReady();
          else
            settleError(
              "This reset link is invalid or has expired. Request a new one from the login page."
            );
        }, 5000);
      } catch (e) {
        if (!cancelled && !settled) {
          settleError(e instanceof Error ? e.message : "Could not verify your reset link.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [markInitFailed, markSessionReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password: password.trim() });
    setSubmitting(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    await supabase.auth.signOut();
    setSuccess(true);
    router.replace("/login?reset=success");
  }

  if (authLoading || (user && !success)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--app-bg)" }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--app-bg)" }}>
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border p-8"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="mb-6 text-center">
            <div className="mb-3 flex justify-center">
              <Image
                src="/brand/logo-icon.png"
                alt={`${BRAND.appName} logo`}
                width={82}
                height={82}
                priority
                style={{ height: 82, width: 82, objectFit: "contain" }}
              />
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Set a new password
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Choose a strong password you haven&apos;t used elsewhere.
            </p>
          </div>

          {success ? (
            <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">
              Redirecting to sign in…
            </p>
          ) : initializing ? (
            <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Verifying your reset link…
            </p>
          ) : initError ? (
            <div className="space-y-4">
              <div className="alert-error px-3 py-2">{initError}</div>
              <a
                href="/login"
                className="block w-full rounded-md border border-primary-600 bg-transparent px-3 py-2.5 text-center text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40"
              >
                Back to sign in
              </a>
            </div>
          ) : sessionReady ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="alert-error px-3 py-2">{error}</div>
              )}
              <div>
                <label htmlFor="new-password" className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD}
                    className="w-full rounded-md border px-3 py-2 pr-20 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    style={{
                      borderColor: "var(--border-soft)",
                      background: "var(--surface-muted)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium hover:bg-black/5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1 block text-sm font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD}
                    className="w-full rounded-md border px-3 py-2 pr-20 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    style={{
                      borderColor: "var(--border-soft)",
                      background: "var(--surface-muted)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium hover:bg-black/5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showConfirm ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-primary-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? "Updating…" : "Update password"}
              </button>
            </form>
          ) : null}

          <div className="mt-6 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <a href="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Back to sign in
            </a>
            <span style={{ opacity: 0.7 }}>v{BRAND.version}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
