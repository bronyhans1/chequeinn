"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasRole, ADMIN_MANAGER_ROLES } from "@/lib/auth/roles";
import * as auditApi from "@/lib/api/audit.api";
import * as usersApi from "@/lib/api/users.api";
import { isApiError } from "@/lib/types/api";
import { getCurrentMonthRange } from "@/lib/utils/date";
import type { AuditLog } from "@/lib/api/audit.api";
import { buildEmployeeDisplayById, presentAuditLog } from "@/lib/audit/auditPresentation";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AuditActivityPage() {
  const { user, isLoading } = useAuth();

  const canViewAudit = hasRole(user?.roles, ADMIN_MANAGER_ROLES);
  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [actorId, setActorId] = useState("");
  const [actionType, setActionType] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<auditApi.AuditLog[]>([]);
  const [employeeDisplayById, setEmployeeDisplayById] = useState<ReadonlyMap<string, string>>(
    () => new Map()
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [logsRes, usersRes] = await Promise.all([
        auditApi.getCompanyAuditLogs(),
        usersApi.getUsers(),
      ]);
      if (isApiError(logsRes)) {
        setError(logsRes.error);
        setLogs([]);
      } else {
        setLogs(logsRes.data);
      }
      if (!isApiError(usersRes)) {
        setEmployeeDisplayById(buildEmployeeDisplayById(usersRes.data));
      } else {
        setEmployeeDisplayById(new Map());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit activity");
      setLogs([]);
      setEmployeeDisplayById(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once when auth is ready (audit is admin/manager-only on the backend).
  useEffect(() => {
    if (isLoading) return;
    if (!canViewAudit) return;
    load();
  }, [isLoading, canViewAudit, load]);

  const filteredLogs = useMemo(() => {
    const actorQuery = actorId.trim().toLowerCase();
    const actionQuery = actionType.trim().toLowerCase();
    const startMs = new Date(start + "T00:00:00").getTime();
    const endMs = new Date(end + "T23:59:59.999").getTime();

    return logs.filter((l) => {
      const ts = new Date(l.created_at).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        if (Number.isNaN(ts) || ts < startMs || ts > endMs) return false;
      }
      if (actorQuery && !(l.actor_id ?? "").toLowerCase().includes(actorQuery)) {
        return false;
      }
      if (actionQuery && !(l.action ?? "").toLowerCase().includes(actionQuery)) {
        return false;
      }
      return true;
    });
  }, [logs, start, end, actorId, actionType]);

  const auditPresentationOpts = useMemo(
    () => ({ employeeDisplayById }),
    [employeeDisplayById]
  );

  const columns: { key: string; header: string; render?: (row: AuditLog) => React.ReactNode }[] = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => presentAuditLog(row, auditPresentationOpts).actionLabel,
    },
    {
      key: "actor_id",
      header: "Actor",
      render: (row) => (
        <span className="text-sm text-theme">
          {row.actor_name ?? row.actor_email ?? "—"}
          {row.actor_email && row.actor_name ? (
            <span className="ml-2 text-xs text-theme-muted">({row.actor_email})</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "entity_type",
      header: "Target",
      render: (row) => (
        <span className="max-w-[280px] text-sm text-theme">
          {presentAuditLog(row, auditPresentationOpts).targetLabel}
        </span>
      ),
    },
    {
      key: "metadata",
      header: "Details",
      render: (row) => {
        const detail = presentAuditLog(row, auditPresentationOpts).detail;
        if (!detail) return <span className="text-sm text-theme-muted">—</span>;
        return <span className="max-w-[520px] text-sm text-theme">{detail}</span>;
      },
    },
  ];

  if (isLoading || loading) {
    return (
      <MainContent title="Audit / Activity">
        <LoadingState message="Loading audit activity…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (!canViewAudit) {
    return (
      <MainContent title="Audit / Activity">
        <ErrorState message="Forbidden: insufficient permissions" />
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent title="Audit / Activity">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Audit / Activity">
      <Card title="Filters">
        <DateRangeFilter
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
          onApply={() => undefined}
          showApply={false}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <div>
            <label htmlFor="actorId" className="mb-1 block text-xs font-medium text-theme-muted">
              Actor ID
            </label>
            <input
              id="actorId"
              type="text"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="e.g. user-uuid"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="actionType" className="mb-1 block text-xs font-medium text-theme-muted">
              Action contains
            </label>
            <input
              id="actionType"
              type="text"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              placeholder="e.g. clock_in"
              className="input-field"
            />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        {filteredLogs.length === 0 ? (
          <EmptyState message="No audit events match your filters" />
        ) : (
          <DataTable
            columns={columns}
            data={filteredLogs}
            keyExtractor={(row) => row.id}
            emptyMessage="No data"
          />
        )}
      </div>
    </MainContent>
  );
}
