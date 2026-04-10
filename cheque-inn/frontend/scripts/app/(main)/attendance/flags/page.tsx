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
import type { FlagsSummaryEmployee } from "@/lib/api/attendance.api";

function FlagLevelBadge({ level }: { level: string }) {
  const variant = level === "high" ? "danger" : level === "medium" ? "warning" : "default";
  return <Badge variant={variant}>{level}</Badge>;
}

export default function AttendanceFlagsPage() {
  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [data, setData] = useState<attendanceApi.FlagsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await attendanceApi.getFlagsSummary(start, end);
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

  const columns: { key: string; header: string; render?: (row: FlagsSummaryEmployee) => React.ReactNode }[] = [
    { key: "name", header: "Employee" },
    { key: "late_count", header: "Late count" },
    { key: "total_late_minutes", header: "Total late (min)" },
    { key: "early_leave_count", header: "Early leave count" },
    { key: "half_day_count", header: "Half day count" },
    { key: "repeated_late", header: "Repeated late", render: (row) => (row.repeated_late ? "Yes" : "No") },
    { key: "repeated_early_leave", header: "Repeated early leave", render: (row) => (row.repeated_early_leave ? "Yes" : "No") },
    { key: "frequent_half_day", header: "Frequent half day", render: (row) => (row.frequent_half_day ? "Yes" : "No") },
    { key: "attention_needed", header: "Attention", render: (row) => (row.attention_needed ? <Badge variant="warning">Yes</Badge> : "No") },
    { key: "attendance_flag_level", header: "Flag level", render: (row) => <FlagLevelBadge level={row.attendance_flag_level} /> },
  ];

  return (
    <MainContent title="Attendance Flags">
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
        <Card title="Flags summary" className="mt-4">
          {data && (
            <>
              <p className="text-sm text-theme-muted">
                Period: {data.period.start} to {data.period.end} — Flagged: {data.summary.employeesFlagged} — High risk: {data.summary.highRiskEmployees}
              </p>
              <div className="mt-4">
                {data.employees.length === 0 ? (
                  <EmptyState message="No flags in this period" />
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
