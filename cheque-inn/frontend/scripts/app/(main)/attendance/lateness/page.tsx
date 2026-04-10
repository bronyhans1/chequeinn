"use client";

import { useState, useCallback } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getCurrentMonthRange } from "@/lib/utils/date";
import * as attendanceApi from "@/lib/api/attendance.api";
import { isApiError } from "@/lib/types/api";
import type { LatenessSummaryEmployee } from "@/lib/api/attendance.api";

export default function LatenessSummaryPage() {
  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [data, setData] = useState<attendanceApi.LatenessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await attendanceApi.getLatenessSummary(start, end);
      if (isApiError(res)) {
        setError(res.error);
        setData(null);
        return;
      }
      setData(res.data);
      setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const columns: { key: string; header: string; render?: (row: LatenessSummaryEmployee) => React.ReactNode }[] = [
    { key: "name", header: "Employee" },
    { key: "late_count", header: "Late count" },
    { key: "total_late_minutes", header: "Total late (min)" },
    { key: "average_late_minutes", header: "Avg late (min)" },
    {
      key: "repeated_late",
      header: "Repeated late",
      render: (row) => (row.repeated_late ? <Badge variant="warning">Yes</Badge> : "No"),
    },
    { key: "latest_late_at", header: "Latest late at", render: (row) => row.latest_late_at ? new Date(row.latest_late_at).toLocaleString() : "—" },
  ];

  return (
    <MainContent title="Lateness Summary">
      <Card title="Date range">
        <DateRangeFilter
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
          onApply={load}
          loading={loading}
        />
      </Card>
      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}
      {!error && applied && (
        <Card title="Summary" className="mt-4">
          {data && (
            <>
              <p className="text-sm text-theme-muted">
                Period: {data.period.start} to {data.period.end} — Total late incidents: {data.summary.totalLateIncidents} — Repeated late employees: {data.summary.repeatedLateEmployees}
              </p>
              <div className="mt-4">
                {data.employees.length === 0 ? (
                  <EmptyState message="No lateness in this period" />
                ) : (
                  <DataTable
                    columns={columns}
                    data={data.employees}
                    keyExtractor={(row) => row.user_id}
                    emptyMessage="No data"
                  />
                )}
              </div>
            </>
          )}
          {loading && data && <LoadingState message="Refreshing…" className="mt-2" />}
        </Card>
      )}
    </MainContent>
  );
}
