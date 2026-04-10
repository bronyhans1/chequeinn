"use client";

import { useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import * as platformApi from "@/lib/api/platform.api";
import { isApiError } from "@/lib/types/api";

function formatFriendlyDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseAuditMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof metadata === "object") {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function toFriendlyPlatformAction(action: string): string {
  switch (action) {
    case "user.create":
      return "Added a new user";
    case "user.update":
      return "Updated a user";
    case "user.delete":
      return "Deleted a user";
    case "user.assign_shift":
      return "Updated an employee's shift";
    case "branch.create":
      return "Created a new branch";
    case "branch.update":
      return "Updated a branch";
    case "branch.delete":
      return "Deleted a branch";
    case "department.create":
      return "Created a new department";
    case "department.update":
      return "Updated a department";
    case "department.delete":
      return "Deleted a department";
    case "session.manual_clock_in":
      return "Manually checked in an employee";
    case "session.manual_clock_out":
      return "Manually checked out an employee";
    case "session.clock_in":
      return "Checked in";
    case "session.clock_out":
      return "Checked out";
    case "platform.company_delete":
      return "Deleted a company";
    case "platform.company_branch_limit_update":
      return "Updated a company's branch limit";
    case "platform.company_status_update":
      return "Updated a company's account status";
    case "platform.user_delete":
      return "Deleted a user from platform";
    default:
      return action
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (s) => s.toUpperCase());
  }
}

/** Same priorities as company dashboard for `user.update` audit rows. */
function toFriendlyPlatformActivityTitle(action: string, metadata: unknown): string {
  const meta = parseAuditMetadata(metadata);
  if (action === "user.update" && meta) {
    if (meta.department_auto_cleared === true) {
      return "Cleared a user's department after a branch change";
    }
    if (meta.department_updated === true) {
      return "Updated a user's department";
    }
    if (meta.branch_updated === true) return "Updated a user's branch";
    if (meta.email_updated === true) return "Updated a user's email";
    if (meta.first_name_updated === true || meta.last_name_updated === true) {
      return "Updated a user's profile";
    }
  }
  return toFriendlyPlatformAction(action);
}

export default function PlatformDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<platformApi.PlatformDashboardData | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.getPlatformDashboard();
      if (isApiError(res)) {
        setError(res.error ?? "Failed to load platform dashboard");
        setData(null);
      } else {
        setData(res.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platform dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <MainContent title="Platform Dashboard">
        <LoadingState message="Loading platform metrics…" className="min-h-[220px]" />
      </MainContent>
    );
  }
  if (error) {
    return (
      <MainContent title="Platform Dashboard">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  const totals = data?.totals;
  return (
    <MainContent title="Platform Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
        <Metric title="Companies" value={totals?.companies ?? 0} />
        <Metric title="Companies (Active)" value={totals?.companies_active ?? 0} />
        <Metric title="Companies (Inactive)" value={totals?.companies_inactive ?? 0} />
        <Metric title="Branches" value={totals?.branches ?? 0} />
        <Metric title="Departments" value={totals?.departments ?? 0} />
        <Metric title="Users (Active)" value={totals?.users_active ?? 0} />
        <Metric
          title="Users (Inactive)"
          subtitle="inactive + suspended"
          value={totals?.users_inactive ?? 0}
        />
      </div>

      <Card title="Recent Activity" className="mt-5">
        {!data?.recent_activity?.length ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No recent activity found.
          </p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.map((a) => (
              <div
                key={a.id}
                className="rounded-md border p-3"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-theme">
                      {toFriendlyPlatformActivityTitle(a.action, a.metadata)}
                    </p>
                    <p className="text-xs text-theme-muted">
                      Company: {a.company_name ?? "Unknown company"}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-theme-muted">
                    {formatFriendlyDateTime(a.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </MainContent>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: number; subtitle?: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value.toLocaleString()}
      </p>
      {subtitle ? (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      ) : null}
    </Card>
  );
}
