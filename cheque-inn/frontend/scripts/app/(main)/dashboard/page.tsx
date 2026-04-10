"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageSection } from "@/components/ui/PageSection";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import * as attendanceApi from "@/lib/api/attendance.api";
import * as leaveApi from "@/lib/api/leave.api";
import * as auditApi from "@/lib/api/audit.api";
import * as payrollApi from "@/lib/api/payroll.api";
import * as usersApi from "@/lib/api/users.api";
import * as companyPolicyApi from "@/lib/api/companyPolicy.api";
import { isApiError } from "@/lib/types/api";
import type { TodayOverview, SessionHistoryItem } from "@/lib/api/attendance.api";
import type { LeaveRequest } from "@/lib/api/leave.api";
import type { AuditLog } from "@/lib/api/audit.api";
import type { PayrollReportResult } from "@/lib/api/payroll.api";
import { buildEmployeeDisplayById, presentAuditLog } from "@/lib/audit/auditPresentation";
import {
  canAccessManagerFeatures,
  canAccessCompanyPayroll,
  isBranchScopedCompanyUser,
  isPlatformAdmin,
} from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { getCurrentMonthRange } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/formatCurrency";

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function formatDateTime(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

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
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** API may return PENDING / pending — normalize for comparisons. */
function normalizeLeaveStatus(status: string): string {
  return (status ?? "").trim().toLowerCase();
}

function formatLeaveStatus(status: string): { label: string; variant: "default" | "success" | "warning" | "danger" } {
  switch (normalizeLeaveStatus(status)) {
    case "pending":
      return { label: "Pending", variant: "warning" };
    case "approved":
      return { label: "Approved", variant: "success" };
    case "rejected":
      return { label: "Rejected", variant: "danger" };
    default:
      return { label: status || "—", variant: "default" };
  }
}

function formatDurationMinutes(m: number | null): string {
  if (m === null || m < 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function sessionStatusBadge(status: string) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return <Badge variant="warning">Active</Badge>;
  if (s === "COMPLETED") return <Badge variant="success">Completed</Badge>;
  if (s === "CANCELLED") return <Badge variant="default">Cancelled</Badge>;
  return <Badge variant="default">{status}</Badge>;
}

function formatActor(log: AuditLog): string {
  return log.actor_name?.trim() || log.actor_email?.trim() || "System";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const canViewCompanyOps = canAccessManagerFeatures(user?.roles);
  const canViewCompanyPayroll = canAccessCompanyPayroll(user?.roles);
  const branchScoped = isBranchScopedCompanyUser(user?.roles);
  const payrollEnabled = user?.payrollEnabled !== false;

  /** All hooks must run before any conditional return (Rules of Hooks). */
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [latenessSummary, setLatenessSummary] = useState<attendanceApi.LatenessSummary | null>(null);
  const [flagsSummary, setFlagsSummary] = useState<attendanceApi.FlagsSummary | null>(null);
  const [absenceSummary, setAbsenceSummary] = useState<attendanceApi.AbsenceSummary | null>(null);
  const [payroll, setPayroll] = useState<PayrollReportResult | null>(null);
  const [currencyCode, setCurrencyCode] = useState<"GHS" | "USD">("GHS");
  const [activeSessions, setActiveSessions] = useState<
    Array<{ user_id: string; check_in: string | null; department_id?: string | null }>
  >([]);
  const [employeesActiveCount, setEmployeesActiveCount] = useState<number | null>(null);
  const [employeesRestrictedCount, setEmployeesRestrictedCount] = useState<number | null>(null);
  const [recentCompanySessions, setRecentCompanySessions] = useState<SessionHistoryItem[]>(
    []
  );
  const [recentMySessions, setRecentMySessions] = useState<SessionHistoryItem[]>([]);
  const [employeeDisplayById, setEmployeeDisplayById] = useState<ReadonlyMap<string, string>>(
    () => new Map()
  );

  const auditPresentationOpts = useMemo(
    () => ({ employeeDisplayById }),
    [employeeDisplayById]
  );

  useEffect(() => {
    if (isLoading) return;
    if (isPlatformAdmin(user?.roles)) {
      router.replace("/platform/companies");
    }
  }, [isLoading, router, user?.roles]);

  async function load() {
    if (isPlatformAdmin(user?.roles)) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const month = getCurrentMonthRange();

      const [todayRes, activeRes] = await Promise.all([
        attendanceApi.getTodayOverview(),
        attendanceApi.getActiveEmployees(),
      ]);
      if (isApiError(todayRes)) {
        setError(todayRes.error);
        return;
      }
      setOverview(todayRes.data);
      if (!isApiError(activeRes)) {
        setActiveCount(activeRes.data.active_count);
        setActiveSessions(activeRes.data.active_sessions ?? []);
      } else {
        setActiveSessions([]);
      }

      if (canViewCompanyOps) {
        const [
          companyLeaveRes,
          auditRes,
          usersRes,
          policyRes,
          latenessRes,
          flagsRes,
          absenceRes,
          companyHistoryRes,
        ] = await Promise.all([
          leaveApi.getCompanyLeaveRequests(),
          auditApi.getCompanyAuditLogs(),
          usersApi.getUsers(),
          companyPolicyApi.getPolicy(),
          attendanceApi.getLatenessSummary(month.start, month.end),
          attendanceApi.getFlagsSummary(month.start, month.end),
          attendanceApi.getAbsenceSummary(month.start, month.end),
          attendanceApi.getCompanySessionHistory({ page: 1, limit: 12 }),
        ]);

        if (isApiError(companyLeaveRes)) throw new Error(companyLeaveRes.error);
        if (isApiError(auditRes)) throw new Error(auditRes.error);
        if (isApiError(latenessRes)) throw new Error(latenessRes.error);
        if (isApiError(flagsRes)) throw new Error(flagsRes.error);
        if (isApiError(absenceRes)) throw new Error(absenceRes.error);

        if (!isApiError(usersRes)) {
          const ulist = usersRes.data ?? [];
          setEmployeeDisplayById(buildEmployeeDisplayById(ulist));
          setEmployeesActiveCount(ulist.filter((u) => u.status === "active").length);
          setEmployeesRestrictedCount(ulist.filter((u) => u.status !== "active").length);
        } else {
          setEmployeeDisplayById(new Map());
          setEmployeesActiveCount(null);
          setEmployeesRestrictedCount(null);
        }
        if (!isApiError(policyRes)) {
          const cc = policyRes.data?.currency_code;
          if (cc === "USD" || cc === "GHS") setCurrencyCode(cc);
        }

        setLeaveRequests(companyLeaveRes.data);
        setAuditLogs(auditRes.data);
        setLatenessSummary(latenessRes.data);
        setFlagsSummary(flagsRes.data);
        setAbsenceSummary(absenceRes.data);
        if (canViewCompanyPayroll && payrollEnabled) {
          const payrollRes = await payrollApi.getCompanyPayroll();
          if (isApiError(payrollRes)) throw new Error(payrollRes.error);
          setPayroll(payrollRes.data);
        } else {
          setPayroll(null);
        }
        if (!isApiError(companyHistoryRes)) {
          setRecentCompanySessions(companyHistoryRes.data.rows ?? []);
        } else {
          setRecentCompanySessions([]);
        }
        setRecentMySessions([]);
      } else {
        const [myLeaveRes, myPayrollRes, myHistoryRes, policyRes] = await Promise.all([
          leaveApi.getMyLeaveRequests(),
          payrollApi.getMyPayroll(),
          attendanceApi.getMySessionHistory({ page: 1, limit: 8 }),
          companyPolicyApi.getPolicy(),
        ]);

        if (isApiError(myLeaveRes)) throw new Error(myLeaveRes.error);
        if (isApiError(myPayrollRes)) throw new Error(myPayrollRes.error);

        setLeaveRequests(myLeaveRes.data);
        setPayroll(myPayrollRes.data);
        setEmployeeDisplayById(new Map());
        if (!isApiError(policyRes)) {
          const cc = policyRes.data?.currency_code;
          if (cc === "USD" || cc === "GHS") setCurrencyCode(cc);
        }
        setRecentCompanySessions([]);
        setActiveSessions([]);
        setEmployeesActiveCount(null);
        setEmployeesRestrictedCount(null);
        if (!isApiError(myHistoryRes)) {
          setRecentMySessions(myHistoryRes.data.rows ?? []);
        } else {
          setRecentMySessions([]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (isPlatformAdmin(user?.roles)) return;
    void load();
  }, [canViewCompanyOps, canViewCompanyPayroll, isLoading, user?.roles, user?.payrollEnabled]);

  if (!isLoading && isPlatformAdmin(user?.roles)) {
    return (
      <MainContent title="Dashboard">
        <LoadingState message="Redirecting to platform console…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  const pendingCompanyLeaveCount = canViewCompanyOps
    ? leaveRequests.filter((r) => normalizeLeaveStatus(r.status) === "pending").length
    : 0;
  const myRecentLeave = leaveRequests.slice(0, 5);
  const recentLeaveForManagers = leaveRequests.slice(0, 8);
  const myLeaveCounts = {
    pending: leaveRequests.filter((r) => normalizeLeaveStatus(r.status) === "pending").length,
    approved: leaveRequests.filter((r) => normalizeLeaveStatus(r.status) === "approved").length,
    rejected: leaveRequests.filter((r) => normalizeLeaveStatus(r.status) === "rejected").length,
  };

  const recentAudit = auditLogs.slice(0, 6);

  const repeatedAbsenceCount =
    absenceSummary?.employees?.filter((e) => e.repeated_absence).length ?? 0;

  const recordsCount = payroll?.records?.length ?? 0;
  const latestPayrollDate =
    payroll?.records?.length
      ? payroll.records
          .map((r) => r.payroll_date)
          .filter(Boolean)
          .reduce((latest, current) => {
            const latestDate = latest ? new Date(latest).getTime() : -Infinity;
            const currentDate = current ? new Date(current).getTime() : -Infinity;
            return currentDate > latestDate ? current : latest;
          }, "")
      : null;

  if (loading && !overview) {
    return (
      <MainContent title="Dashboard">
        <LoadingState message="Loading dashboard…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent title="Dashboard">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Present today" value={overview?.present ?? 0} subtitle="Employees with a session" />
        <StatCard title="Active now" value={activeCount ?? overview?.active ?? 0} subtitle="Currently clocked in" />
        <StatCard title="Completed today" value={overview?.completed ?? 0} subtitle="Sessions ended" />
        <StatCard title="Total minutes" value={overview ? formatMinutes(overview.total_minutes_today) : "—"} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Late today" value={overview?.late_today ?? 0} />
        <StatCard title="Overtime today" value={overview?.overtime_today ?? 0} />
        <StatCard title="Absent today" value={overview?.absent_today ?? 0} />
      </div>

      {canViewCompanyOps ? (
        <PageSection className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-theme-muted">
            Today · Team
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Employees active now">
              {employeesActiveCount !== null && employeesRestrictedCount !== null ? (
                <p className="mb-3 text-sm text-theme-muted">
                  <span className="font-semibold text-theme">{employeesActiveCount}</span> active accounts ·{" "}
                  <span className="font-semibold text-theme">{employeesRestrictedCount}</span> inactive or suspended
                  <span className="block text-xs mt-1">
                    “Inactive or suspended” cannot sign in; totals include all employees you can list in your scope.
                  </span>
                </p>
              ) : null}
              {activeSessions.length === 0 ? (
                <EmptyState message="No one is currently clocked in." />
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {activeSessions.slice(0, 12).map((s) => (
                    <li
                      key={`${s.user_id}-${s.check_in ?? ""}`}
                      className="flex justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      style={{ borderColor: "var(--border-soft)" }}
                    >
                      <span className="truncate font-mono text-theme" title={s.user_id}>
                        {s.user_id.slice(0, 8)}…
                      </span>
                      <span className="shrink-0 text-xs text-theme-muted">
                        {formatDateTime(s.check_in)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/employees"
                className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Employees →
              </Link>
            </Card>
            <Card title={"Today's attendance summary"}>
              <p className="text-sm leading-relaxed text-theme-muted">
                <span className="font-semibold text-theme">{overview?.present ?? 0}</span>{" "}
                present ·{" "}
                <span className="font-semibold text-theme">{overview?.completed ?? 0}</span>{" "}
                completed ·{" "}
                <span className="font-semibold text-theme">{overview?.late_today ?? 0}</span>{" "}
                late ·{" "}
                <span className="font-semibold text-theme">{overview?.absent_today ?? 0}</span>{" "}
                absent.
              </p>
              <p className="mt-2 text-sm text-theme-muted">
                Time tracked today:{" "}
                <span className="font-medium text-theme">
                  {overview ? formatMinutes(overview.total_minutes_today) : "—"}
                </span>
              </p>
              <Link
                href="/attendance"
                className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Attendance hub →
              </Link>
            </Card>
            <Card title="Leave awaiting review">
              <p className="text-4xl font-semibold text-theme">{pendingCompanyLeaveCount}</p>
              <p className="text-sm text-theme-muted">Pending requests</p>
              <Link
                href="/leave"
                className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Review leave →
              </Link>
            </Card>
          </div>
        </PageSection>
      ) : (
        <PageSection className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-theme-muted">
            My leave
          </h2>
          <Card title="Status overview">
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">Pending: {myLeaveCounts.pending}</Badge>
              <Badge variant="success">Approved: {myLeaveCounts.approved}</Badge>
              <Badge variant="danger">Rejected: {myLeaveCounts.rejected}</Badge>
            </div>
            <p className="mt-3 text-sm text-theme-muted">
              {leaveRequests.length === 0
                ? "You haven't submitted any leave requests yet."
                : `You have ${leaveRequests.length} request(s) on file.`}
            </p>
            <Link
              href="/leave"
              className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Request or view leave →
            </Link>
          </Card>
        </PageSection>
      )}

      <PageSection className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-theme-muted">
          Recent records
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title={
              canViewCompanyOps ? "Recent attendance (company)" : "Recent attendance (mine)"
            }
          >
            {(canViewCompanyOps ? recentCompanySessions : recentMySessions).length === 0 ? (
              <EmptyState message="No recent sessions in this window." />
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {(canViewCompanyOps ? recentCompanySessions : recentMySessions).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border p-3 text-sm"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {canViewCompanyOps ? (
                          <p className="truncate font-medium text-theme">
                            {row.employee_name ?? `${row.user_id.slice(0, 8)}…`}
                          </p>
                        ) : null}
                        <p className="text-xs text-theme-muted">
                          In: {formatDateTime(row.check_in)} · Out: {formatDateTime(row.check_out)}
                        </p>
                      </div>
                      {sessionStatusBadge(row.status)}
                    </div>
                    <p className="mt-1 text-xs text-theme-muted">
                      {[row.branch_name, row.department_name].filter(Boolean).join(" · ") || "—"} ·{" "}
                      {formatDurationMinutes(row.duration_minutes)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/attendance/history"
              className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View full history →
            </Link>
          </Card>

          <Card
            title={
              canViewCompanyOps
                ? branchScoped
                  ? "Recent leave (branch)"
                  : "Recent leave requests"
                : "Recent leave"
            }
          >
            {leaveRequests.length === 0 ? (
              <EmptyState message="No leave requests yet." />
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {(canViewCompanyOps ? recentLeaveForManagers : myRecentLeave).map((r) => {
                  const s = formatLeaveStatus(r.status);
                  return (
                    <div
                      key={r.id}
                      className="rounded-md border p-3"
                      style={{ borderColor: "var(--border-soft)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-theme">{r.leave_type}</p>
                          <p className="text-xs text-theme-muted">
                            {r.start_date} → {r.end_date}
                          </p>
                          {canViewCompanyOps ? (
                            <p className="mt-1 text-xs text-theme-muted">
                              {r.employee_name ?? r.user_id}
                              {r.employee_email ? (
                                <span className="opacity-70"> · {r.employee_email}</span>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href="/leave"
              className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Open leave →
            </Link>
          </Card>
        </div>
      </PageSection>

      <PageSection className="mt-6">
        <div className="grid gap-4 lg:grid-cols-2">
        {canViewCompanyOps ? (
          <Card title="Attendance alerts (current month)">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Flagged employees" value={flagsSummary?.summary.highRiskEmployees ?? 0} subtitle="High risk (flags)" />
              <StatCard title="Repeated late" value={latenessSummary?.summary.repeatedLateEmployees ?? 0} subtitle="Across month range" />
              <StatCard title="Repeated absence" value={repeatedAbsenceCount} subtitle="Users with repeats" />
            </div>
          </Card>
        ) : (
          <Card title="Attendance alerts">
            <EmptyState message="Not available for employee role" />
          </Card>
        )}
        </div>
      </PageSection>

      {canViewCompanyOps ? (
        <PageSection className="mt-6">
          <div className={`grid gap-4 ${payrollEnabled ? "lg:grid-cols-2" : ""}`}>
            <Card title="Recent activity">
              {recentAudit.length === 0 ? (
                <EmptyState message="No audit events found" />
              ) : (
                <div className="space-y-2">
                  {recentAudit.map((l) => {
                    const view = presentAuditLog(l, auditPresentationOpts);
                    return (
                      <div
                        key={l.id}
                        className="rounded-md border p-3"
                        style={{ borderColor: "var(--border-soft)" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-theme">{view.actionLabel}</p>
                            <p className="text-xs text-theme-muted">
                              by {formatActor(l)}
                            </p>
                            {view.detail ? <p className="text-xs text-theme-muted">{view.detail}</p> : null}
                          </div>
                          <p className="whitespace-nowrap text-xs text-theme-muted">{formatFriendlyDateTime(l.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {payrollEnabled ? (
              <Card title="Payroll snapshot">
                {!canViewCompanyPayroll ? (
                  <EmptyState message="Company payroll overview is available to Admin and HR." />
                ) : payroll ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <StatCard
                        title="Gross pay"
                        value={formatCurrency(payroll.total_gross_pay, currencyCode)}
                        subtitle="Total gross earnings"
                      />
                      <StatCard title="Records" value={recordsCount} subtitle="Payroll rows" />
                      <StatCard
                        title="Latest date"
                        value={latestPayrollDate ? latestPayrollDate : "—"}
                        subtitle="Most recent payroll_date"
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No payroll data yet" />
                )}
              </Card>
            ) : null}
          </div>
        </PageSection>
      ) : payrollEnabled ? (
        <PageSection className="mt-6">
          <Card title="Payroll snapshot">
            {payroll ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    title="Gross pay"
                    value={formatCurrency(payroll.total_gross_pay, currencyCode)}
                    subtitle="Your total gross earnings"
                  />
                  <StatCard title="Records" value={recordsCount} subtitle="Payroll rows" />
                  <StatCard
                    title="Latest date"
                    value={latestPayrollDate ? latestPayrollDate : "—"}
                    subtitle="Most recent payroll_date"
                  />
                </div>
              </div>
            ) : (
              <EmptyState message="No payroll data yet" />
            )}
          </Card>
        </PageSection>
      ) : null}
    </MainContent>
  );
}
