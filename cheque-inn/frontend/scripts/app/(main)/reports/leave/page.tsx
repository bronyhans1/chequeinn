"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canAccessManagerFeatures, hasRole } from "@/lib/auth/roles";
import { getCurrentMonthRange } from "@/lib/utils/date";
import { ReportDatePresetButtons } from "@/components/ui/ReportDatePresetButtons";
import { ExportSuccessNotice } from "@/components/ui/ExportSuccessNotice";
import * as reportsApi from "@/lib/api/reports.api";
import * as usersApi from "@/lib/api/users.api";
import * as branchesApi from "@/lib/api/branches.api";
import { isApiError } from "@/lib/types/api";
import type { UserListItem } from "@/lib/api/users.api";
import type { BranchDto } from "@/lib/api/branches.api";

function statusBadge(status: string) {
  const s = status?.toLowerCase() ?? "";
  if (s === "approved") return <Badge variant="success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function LeaveReportPage() {
  const { user } = useAuth();
  const allowed = canAccessManagerFeatures(user?.roles);
  const canFilterBranch = hasRole(user?.roles, ["admin"]);

  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<"" | "pending" | "approved" | "rejected">("");
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [rows, setRows] = useState<reportsApi.LeaveReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const u = await usersApi.getUsers();
      if (!isApiError(u)) setEmployees(u.data ?? []);
      try {
        const b = await branchesApi.getBranches();
        if (!isApiError(b)) setBranches(b.data ?? []);
      } catch {
        setBranches([]);
      }
    })();
  }, [allowed]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setError(null);
    setLoading(true);
    try {
      const res = await reportsApi.getLeaveReport({
        start,
        end,
        page,
        limit,
        user_id: employeeId.trim() || undefined,
        branch_id: canFilterBranch && branchId.trim() ? branchId.trim() : undefined,
        status: status || undefined,
      });
      if (isApiError(res)) {
        setError(res.error ?? "Failed to load report");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(res.data?.rows ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [allowed, start, end, page, limit, employeeId, branchId, status, canFilterBranch]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExportCsv() {
    setError(null);
    setExportSuccess(null);
    if (!start || !end) {
      setError("Start and end dates are required.");
      return;
    }
    setExportBusy(true);
    try {
      const result = await reportsApi.downloadLeaveReportCsv({
        start,
        end,
        user_id: employeeId.trim() || undefined,
        branch_id: canFilterBranch && branchId.trim() ? branchId.trim() : undefined,
        status: status || undefined,
      });
      if (!result.ok) setError(result.error ?? "Export failed");
      else
        setExportSuccess(
          "Download started — check your downloads. Large CSVs may be truncated at 10,000 rows; narrow filters or the date range if you see a truncation line at the top of the file."
        );
    } finally {
      setExportBusy(false);
    }
  }

  if (!allowed) {
    return (
      <MainContent title="Leave report">
        <EmptyState message="This report is available to admin, manager, and HR only." />
      </MainContent>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <MainContent title="Leave report">
      <p className="mb-2 text-sm text-theme-muted">
        <Link href="/reports" className="font-medium text-primary-600 hover:text-primary-700">
          ← Reports & Exports
        </Link>
      </p>
      <p className="mb-4 text-sm text-theme-muted">
        Leave requests overlapping the selected period. Managers and HR see their branch only; admins
        can filter by branch.
      </p>

      <Card title="Filters">
        <p className="mb-3 text-xs text-theme-muted">
          On-screen results are paginated (50 per page). CSV exports may include up to 10,000 rows.
        </p>
        <ReportDatePresetButtons
          className="mb-3"
          disabled={loading || exportBusy}
          onSelect={(s, e) => {
            setPage(1);
            setStart(s);
            setEnd(e);
          }}
        />
        <DateRangeFilter
          start={start}
          end={end}
          onStartChange={(v) => {
            setPage(1);
            setStart(v);
          }}
          onEndChange={(v) => {
            setPage(1);
            setEnd(v);
          }}
          onApply={() => {
            setPage(1);
            void load();
          }}
          loading={loading}
        />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="rep-lv-status" className="mb-1 block text-xs font-medium text-theme-muted">
              Status
            </label>
            <select
              id="rep-lv-status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as typeof status);
              }}
              className="input-field rounded-md py-2"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label htmlFor="rep-lv-emp" className="mb-1 block text-xs font-medium text-theme-muted">
              Employee (optional)
            </label>
            <select
              id="rep-lv-emp"
              value={employeeId}
              onChange={(e) => {
                setPage(1);
                setEmployeeId(e.target.value);
              }}
              className="input-field max-w-xs rounded-md py-2"
            >
              <option value="">All in scope</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {[e.first_name, e.last_name].filter(Boolean).join(" ") || e.email}
                </option>
              ))}
            </select>
          </div>
          {canFilterBranch ? (
            <div>
              <label htmlFor="rep-lv-branch" className="mb-1 block text-xs font-medium text-theme-muted">
                Branch (optional)
              </label>
              <select
                id="rep-lv-branch"
                value={branchId}
                onChange={(e) => {
                  setPage(1);
                  setBranchId(e.target.value);
                }}
                className="input-field max-w-xs rounded-md py-2"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={exportBusy || loading}
            className="w-fit rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {exportBusy ? "Exporting…" : "Export CSV"}
          </button>
          <ExportSuccessNotice message={exportSuccess} />
        </div>
      </Card>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}

      <Card title="Results" className="mt-6">
        {loading && rows.length === 0 ? (
          <LoadingState message="Loading report…" className="min-h-[120px]" />
        ) : rows.length === 0 ? (
          <EmptyState message="No leave requests overlap this period for the selected filters. Try a wider date range, adjust status, or clear optional filters. Managers and HR only see their branch." />
        ) : (
          <>
            {loading ? (
              <p className="mb-2 text-xs text-primary-600" aria-live="polite">
                Updating results…
              </p>
            ) : null}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-theme-muted">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
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
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary btn-secondary-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-theme">
                <thead>
                  <tr
                    className="border-b text-xs uppercase text-theme-muted"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">Branch</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Start</th>
                    <th className="py-2 pr-3">End</th>
                    <th className="py-2 pr-3">Days</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Reviewed by</th>
                    <th className="py-2 pr-3">Reviewed at</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b"
                      style={{ borderColor: "var(--border-soft)" }}
                    >
                      <td className="py-2 pr-3">
                        <div className="font-medium text-theme">{r.employee_name}</div>
                        <div className="text-xs text-theme-muted">{r.employee_email}</div>
                      </td>
                      <td className="py-2 pr-3">{r.branch_name || "—"}</td>
                      <td className="py-2 pr-3">{r.leave_type}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.start_date}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.end_date}</td>
                      <td className="py-2 pr-3">{r.total_days}</td>
                      <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                      <td className="py-2 pr-3">{r.reviewed_by_name || "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-theme-muted">
                        {r.reviewed_at
                          ? new Date(r.reviewed_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </MainContent>
  );
}
