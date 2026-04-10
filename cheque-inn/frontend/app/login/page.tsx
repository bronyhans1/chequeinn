"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDefaultHomeRoute } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { BRAND } from "@/lib/branding";
import * as authApi from "@/lib/api/auth.api";
import { isApiError } from "@/lib/types/api";

function useSyncHtmlThemeFromStorage() {
  useEffect(() => {
    const root = document.documentElement;
    function apply() {
      const raw = localStorage.getItem("cheque_inn_theme_pref");
      const pref = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = pref === "dark" || (pref === "system" && systemDark);
      root.classList.toggle("dark", dark);
    }
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

function LoginLegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="w-full max-w-lg shrink-0 px-2 pb-6 pt-3 text-center text-xs leading-snug sm:mx-auto sm:max-w-xl sm:px-4"
      style={{ color: "var(--text-muted)" }}
    >
      <p>Cheque-Inn © {year}</p>
      <p className="mt-2 text-pretty">
        By continuing, you agree to Cheque-Inn’s{" "}
        <Link
          href="/terms"
          className="font-medium text-primary-600 underline-offset-2 transition-colors duration-150 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="font-medium text-primary-600 underline-offset-2 transition-colors duration-150 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </footer>
  );
}

export default function LoginPage() {
  useSyncHtmlThemeFromStorage();
  const router = useRouter();
  const { login, user, isLoading, accountAccessBlocked, clearAccountAccessBlocked } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("reset") === "success") {
        setInfo("Your password was updated. You can sign in now.");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(getDefaultHomeRoute(user.roles));
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="login-page-shell flex min-h-screen flex-col overflow-x-clip px-3 sm:px-4">
        <div className="login-art-layer login-art-layer--light dark:hidden" aria-hidden />
        <div className="login-art-layer login-art-layer--dark hidden dark:block" aria-hidden />
        <div className="login-page-content flex flex-1 items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </div>
        <LoginLegalFooter />
      </div>
    );
  }

  if (user) {
    return (
      <div className="login-page-shell flex min-h-screen flex-col overflow-x-clip px-3 sm:px-4">
        <div className="login-art-layer login-art-layer--light dark:hidden" aria-hidden />
        <div className="login-art-layer login-art-layer--dark hidden dark:block" aria-hidden />
        <div className="login-page-content flex flex-1 items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
          Redirecting…
        </div>
        <LoginLegalFooter />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    clearAccountAccessBlocked();
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.ok && result.roles?.length) {
      router.replace(getDefaultHomeRoute(result.roles));
    } else if (!result.ok && !result.accessBlocked) {
      setError(result.error ?? "Login failed");
    }
    /** When `result.accessBlocked`, only `accountAccessBlocked` from context is shown (single message). */
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);
    const normalized = email.trim();
    if (!normalized) {
      setError("Enter your email first, then click Forgot password.");
      return;
    }
    if (!supabase) {
      setError("Password reset is not available: Supabase is not configured.");
      return;
    }
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    });
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setInfo("Password reset link sent. Check your email inbox.");
  }

  return (
    <div className="login-page-shell flex min-h-screen flex-col overflow-x-clip px-3 sm:px-4">
      <div className="login-art-layer login-art-layer--light dark:hidden" aria-hidden />
      <div className="login-art-layer login-art-layer--dark hidden dark:block" aria-hidden />
      <div className="login-page-content flex w-full min-w-0 flex-1 items-center justify-center py-6 sm:py-8">
        <div className="w-full min-w-0 max-w-md">
          <div
            className="rounded-2xl border p-5 sm:p-8"
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
              <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Sign in to continue to your workspace</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(accountAccessBlocked?.message || error) && (
                <div
                  className="rounded-lg border px-3 py-2 text-sm font-medium"
                  style={{
                    borderColor: "var(--state-error-border)",
                    background: "var(--state-error-bg)",
                    color: "var(--state-error-text)",
                  }}
                  role="alert"
                >
                  {accountAccessBlocked?.message ?? error}
                </div>
              )}
              {info && (
                <div
                  className="rounded-lg border px-3 py-2 text-sm font-medium"
                  style={{
                    borderColor: "var(--state-success-border)",
                    background: "var(--state-success-bg)",
                    color: "var(--state-success-text)",
                  }}
                >
                  {info}
                </div>
              )}
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="input-field"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input-field pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs font-medium transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
              <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Smarter Workforce. Seamless Management.
              </p>
            </form>

            <div
              className="mt-6 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2"
              style={{ color: "var(--text-muted)" }}
            >
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="break-words text-center font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700 sm:text-left"
              >
                Need help? Contact Us
              </a>
              <span className="text-center sm:text-right" style={{ opacity: 0.7 }}>
                v{BRAND.version}
              </span>
            </div>
          </div>
        </div>
      </div>
      <LoginLegalFooter />
    </div>
  );
}
