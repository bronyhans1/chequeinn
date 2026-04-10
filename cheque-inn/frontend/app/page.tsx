"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/branding";

/** Landing / sales contact — organizations request onboarding here (not in-app support). */
const LANDING_CONTACT_MAILTO =
  "mailto:support@chequeinn.com?subject=" + encodeURIComponent("Request access — Cheque-Inn Systems");

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

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-icon.png"
      alt={`${BRAND.appName} logo`}
      width={120}
      height={40}
      priority
      className={`h-[40px] w-auto max-w-[120px] object-contain ${className}`}
    />
  );
}

export default function HomePage() {
  useSyncHtmlThemeFromStorage();

  return (
    <div className="landing-shell flex flex-col">
      <div className="flex min-h-screen flex-col">
        <header className="mx-auto w-full max-w-6xl px-6 pt-6">
          <div
            className="landing-chrome flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 shadow-sm sm:px-5"
            style={{
              borderColor: "var(--border-soft)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <Link href="/" className="group inline-flex items-center gap-3">
              <BrandMark />
              <div className="hidden min-[380px]:block leading-tight">
                <div className="text-sm font-semibold tracking-tight">Cheque-Inn Systems</div>
                <div className="text-xs text-theme-muted">Workforce Management</div>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={LANDING_CONTACT_MAILTO}
                className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-primary)" }}
              >
                Let’s Talk
              </a>
              <Link
                href="/login"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35"
                aria-label="Sign in"
              >
                Sign in
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-10 sm:pt-12">
          {/* HERO */}
          <section className="grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-7">
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.15rem] lg:leading-[1.06]">
                Smarter Workforce. Seamless Management.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-[1.65] text-theme-muted sm:text-[1.0625rem]">
                One platform for attendance, payroll visibility, leave, and reporting.{" "}
                <span className="text-theme">Admins</span> run the organization on the web;{" "}
                <span className="text-theme">teams</span> use mobile on-site and across locations.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-900/10 transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35"
                >
                  Sign in
                </Link>
                <a
                  href={LANDING_CONTACT_MAILTO}
                  className="rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border-soft)",
                    color: "var(--text-primary)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  Request access
                </a>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-theme-muted">
                New organization? Use <span className="font-medium text-theme">Request access</span> or{" "}
                <a
                  href={LANDING_CONTACT_MAILTO}
                  className="font-medium text-primary-600 underline-offset-2 hover:underline dark:text-primary-400"
                >
                  contact us
                </a>{" "}
                to start onboarding.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border-soft)",
                  boxShadow: "var(--shadow-soft), 0 18px 60px rgba(15, 23, 42, 0.06)",
                }}
              >
                <div
                  className="flex items-center gap-2 border-b px-4 py-2.5"
                  style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
                >
                  <span className="flex gap-1" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-[var(--border-soft)]" />
                    <span className="h-2 w-2 rounded-full bg-[var(--border-soft)]" />
                    <span className="h-2 w-2 rounded-full bg-[var(--border-soft)]" />
                  </span>
                  <span className="ml-1 text-xs font-medium text-theme-muted">Cheque-Inn · Workspace</span>
                </div>
                <div className="px-6 py-6 sm:px-7 sm:py-7">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-theme-muted">Overview</p>
                  <p className="mt-3 text-sm font-semibold leading-snug text-theme">
                    Workforce operations in one view
                  </p>
                  <div className="mt-5 space-y-4 text-sm leading-relaxed text-theme-muted">
                    <div className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600 opacity-80 dark:bg-primary-400" aria-hidden />
                      <p>
                        <span className="font-medium text-theme">Attendance</span> — QR and GPS at clock-in, built for
                        on-site teams
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600 opacity-55 dark:bg-primary-400" aria-hidden />
                      <p>
                        <span className="font-medium text-theme">Earnings &amp; leave</span> — Visibility aligned to how
                        your company defines pay and policy
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600 opacity-35 dark:bg-primary-400" aria-hidden />
                      <p>
                        <span className="font-medium text-theme">Governance</span> — Roles, branches, reporting, and
                        audit-friendly oversight
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ONBOARDING / ACCESS */}
          <section id="get-access" className="mt-16 scroll-mt-24 sm:mt-20">
            <div className="surface-callout rounded-2xl px-6 py-7 sm:px-8 sm:py-8">
              <h2 className="text-lg font-semibold sm:text-xl">How your organization gets started</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-theme-muted sm:text-base">
                We onboard companies directly: you reach out, we align on structure, then your team goes live with guardrails that fit how you operate.
              </p>
              <ol className="mt-8 grid list-none gap-8 p-0 sm:grid-cols-3 sm:gap-6">
                <li>
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                    Contact
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-theme-muted">
                    Request access and tell us about your organization. We&apos;ll confirm next steps and timing.
                  </p>
                </li>
                <li>
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                    Configure
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-theme-muted">
                    Together we set up branches, roles, policies, and payroll-related settings so data matches how you
                    already work.
                  </p>
                </li>
                <li>
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                    Launch
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-theme-muted">
                    Admins use the web app; employees use mobile. You roll out with a clear baseline for attendance and
                    oversight.
                  </p>
                </li>
              </ol>
              <div className="mt-8">
                <a
                  href={LANDING_CONTACT_MAILTO}
                  className="inline-flex rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35"
                >
                  Contact us to request access
                </a>
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section className="mt-16 sm:mt-20">
            <h2 className="text-lg font-semibold sm:text-xl">Core capabilities</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted sm:text-base">
              Everything you need to run attendance and workforce workflows in one place.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Attendance Tracking",
                  body: "QR + GPS-based attendance tracking for office teams",
                },
                {
                  title: "Payroll & Live Earnings",
                  body: "Transparent payroll insights and real-time earnings visibility",
                },
                {
                  title: "Leave Management",
                  body: "Employees can request leave and managers can review approvals easily",
                },
                {
                  title: "Reports & Oversight",
                  body: "View attendance summaries, audit logs, and workforce insights",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border p-5 transition-shadow hover:shadow-md"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border-soft)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <h3 className="text-sm font-semibold leading-snug">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-theme-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* WHO IT'S FOR */}
          <section className="mt-16 sm:mt-20">
            <h2 className="text-lg font-semibold sm:text-xl">Who it&apos;s for</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted sm:text-base">
              Built for teams that operate across sites and shifts—not just desk-based offices.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["Offices", "Factories", "Warehouses", "Multi-branch businesses"].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border px-4 py-3.5 text-sm font-semibold"
                  style={{ background: "var(--surface)", borderColor: "var(--border-soft)" }}
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* WEB + MOBILE */}
          <section className="mt-16 sm:mt-20">
            <div
              className="rounded-2xl border p-6 sm:p-8"
              style={{ background: "var(--surface)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-soft)" }}
            >
              <h2 className="text-lg font-semibold sm:text-xl">Web for leadership, mobile for your workforce</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-theme-muted sm:text-base">
                Company admins, HR, and managers use the <span className="font-medium text-theme">web application</span>{" "}
                for administration, configuration, and oversight. Employees use the{" "}
                <span className="font-medium text-theme">mobile app</span> to clock in and out, view leave, and stay
                connected on the go.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div
                  className="rounded-xl border px-4 py-4"
                  style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Web app</div>
                  <div className="mt-2 text-sm font-semibold leading-snug">Administration & oversight</div>
                  <p className="mt-2 text-sm leading-relaxed text-theme-muted">Policies, payroll settings, reports, and people management.</p>
                </div>
                <div
                  className="rounded-xl border px-4 py-4"
                  style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Mobile app</div>
                  <div className="mt-2 text-sm font-semibold leading-snug">Attendance & self-service</div>
                  <p className="mt-2 text-sm leading-relaxed text-theme-muted">Clock-in/out, leave, and updates from the field.</p>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer
          className="mt-auto border-t"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <div className="landing-footer-surface mx-auto max-w-6xl rounded-t-2xl px-6 py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold">
                Cheque-Inn Systems © {new Date().getFullYear()}. All rights reserved.
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <Link href="/privacy" className="text-theme-muted transition-colors hover:text-theme">
                  Privacy
                </Link>
                <Link href="/terms" className="text-theme-muted transition-colors hover:text-theme">
                  Terms
                </Link>
                <a
                  href={LANDING_CONTACT_MAILTO}
                  className="font-medium text-theme-muted transition-colors hover:text-theme"
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
