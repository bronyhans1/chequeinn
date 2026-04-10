"use client";

import { useCallback, useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import * as attendanceApi from "@/lib/api/attendance.api";
import * as usersApi from "@/lib/api/users.api";
import { isApiError } from "@/lib/types/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasRole, isBranchScopedCompanyUser } from "@/lib/auth/roles";
import type { SessionHistoryItem } from "@/lib/api/attendance.api";
import type { UserListItem } from "@/lib/api/users.api";
import { ManualAttendanceModal } from "@/components/attendance/ManualAttendanceModal";
import { MANUAL_ATTENDANCE_REASONS } from "@/lib/attendance/manualAttendance";

function formatDurationMinutes(m: number | null): string {
  if (m === null || m < 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: string) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return <Badge variant="warning">Active</Badge>;
  if (s === "COMPLETED") return <Badge variant="success">Completed</Badge>;
  if (s === "CANCELLED") return <Badge variant="default">Cancelled</Badge>;
  return <Badge variant="default">{status}</Badge>;
}

function reasonLabel(code: string | null | undefined): string {
  if (!code) return "";
  return MANUAL_ATTENDANCE_REASONS.find((x) => x.code === code)?.label ?? code.replace(/_/g, " ");
}

function manualSummary(r: SessionHistoryItem): string {
  const parts: string[] = [];
  if (r.manual_check_in) {
    parts.push(`In: ${reasonLabel(r.manual_check_in_reason)}`);
  }
  if (r.manual_check_out) {
    parts.push(`Out: ${reasonLabel(r.manual_check_out_reason)}`);
  }
  return parts.join(" · ");
}

/** Both ends manual → Manual; one end → Partial; else ordinary session. */
function manualColumnLabel(r: SessionHistoryItem): "Manual" | "Partial" | null {
  const inM = !!r.manual_check_in;
  const outM = !!r.manual_check_out;
  if (inM && outM) return "Manual";
  if (inM || outM) return "Partial";
  return null;
}

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const canViewCompany = hasRole(user?.roles, ["admin", "manager", "HR"]);
  const branchScoped = isBranchScopedCompanyUser(user?.roles);

  const [rows, setRows] = useState<SessionHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [manualOpen, setManualOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        start: start.trim() || undefined,
        end: end.trim() || undefined,
        user_id: canViewCompany && employeeFilter ? employeeFilter : undefined,
      };

      const res = canViewCompany
        ? await attendanceApi.getCompanySessionHistory(params)
        : await attendanceApi.getMySessionHistory(params);

      if (isApiError(res)) {
        setError(res.error);
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(res.data.rows);
      setTotal(res.data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, start, end, employeeFilter, canViewCompany]);

  useEffect(() => {
    if (!canViewCompany) return;
    (async () => {
      const res = await usersApi.getUsers();
      if (!isApiError(res)) setEmployees(res.data ?? []);
    })();
  }, [canViewCompany]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MainContent title="Attendance history">
      <p className="mb-4 text-sm text-theme-muted">
        {canViewCompany
          ? branchScoped
            ? "Sessions for employees in your office. Defaults to the last 90 days if no dates are set."
            : "Company sessions across the selected period. Defaults to the last 90 days if no dates are set."
          : "Your work sessions. Defaults to the last 90 days if no dates are set."}
      </p>

      <Card title="Filters">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="hist-start" className="mb-1 block text-xs font-medium text-theme-muted">
              From (optional)
            </label>
            <input
              id="hist-start"
              type="date"
              value={start}
              onChange={(e) => {
                setPage(1);
                setStart(e.target.value);
              }}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="hist-end" className="mb-1 block text-xs font-medium text-theme-muted">
              To (optional)
            </label>
            <input
              id="hist-end"
              type="date"
              value={end}
              onChange={(e) => {
                setPage(1);
                setEnd(e.target.value);
              }}
              className="input-field"
            />
          </div>
          {canViewCompany ? (
            <div className="min-w-[200px]">
              <label htmlFor="hist-emp" className="mb-1 block text-xs font-medium text-theme-muted">
                Employee
              </label>
              <select
                id="hist-emp"
                value={employeeFilter}
                onChange={(e) => {
                  setPage(1);
                  setEmployeeFilter(e.target.value);
                }}
                className="input-field w-full"
              >
                <option value="">All employees</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {canViewCompany ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="btn-secondary"
            >
              Manual attendance…
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setPage(1);
              load();
            }}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Refresh
          </button>
        </div>
      </Card>

      <Card title="Sessions" className="mt-6">
        {loading && rows.length === 0 ? (
          <LoadingState message="Loading sessions…" className="min-h-[160px]" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState message="No sessions in this period." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y text-sm text-theme divide-[color:var(--border-soft)]">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-theme-muted">
                    {canViewCompany ? <th className="pb-3 pr-4">Employee</th> : null}
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Check in</th>
                    <th className="pb-3 pr-4">Check out</th>
                    <th className="pb-3 pr-4">Duration</th>
                    <th className="pb-3 pr-4">
                      {canViewCompany ? "Branch" : "Office"}
                    </th>
                    <th className="pb-3 pr-4">Department</th>
                    <th className="pb-3 pr-4">Manual</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-soft)]">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      {canViewCompany ? (
                        <td className="py-3 pr-4">
                          {r.employee_name ?? "—"}
                          {r.employee_email ? (
                            <span className="block text-xs text-theme-muted">{r.employee_email}</span>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {r.check_in
                          ? new Date(r.check_in).toLocaleDateString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(r.check_in)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(r.check_out)}</td>
                      <td className="py-3 pr-4">{formatDurationMinutes(r.duration_minutes)}</td>
                      <td className="py-3 pr-4">{r.branch_name ?? "—"}</td>
                      <td className="py-3 pr-4">{r.department_name ?? "—"}</td>
                      <td className="max-w-[200px] py-3 pr-4" title={manualSummary(r) || undefined}>
                        {(() => {
                          const label = manualColumnLabel(r);
                          if (!label) {
                            return <span className="text-theme-muted">—</span>;
                          }
                          if (label === "Manual") {
                            return <Badge variant="warning">Manual</Badge>;
                          }
                          return <Badge variant="default">Partial</Badge>;
                        })()}
                      </td>
                      <td className="py-3">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-theme-muted">
              Showing {rows.length} of {total} session{total !== 1 ? "s" : ""} (page {page}).
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary btn-secondary-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary btn-secondary-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </Card>

      {canViewCompany ? (
        <ManualAttendanceModal
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          employees={employees}
          initialUserId={employeeFilter || null}
          onSuccess={() => void load()}
        />
      ) : null}
    </MainContent>
  );
}
