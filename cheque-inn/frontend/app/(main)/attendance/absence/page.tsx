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
import type { AbsenceSummaryEmployee } from "@/lib/api/attendance.api";

export default function AbsenceSummaryPage() {
  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [data, setData] = useState<attendanceApi.AbsenceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await attendanceApi.getAbsenceSummary(start, end);
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

  const columns: { key: string; header: string; render?: (row: AbsenceSummaryEmployee) => React.ReactNode }[] = [
    { key: "name", header: "Employee" },
    { key: "absence_count", header: "Absence count" },
    { key: "repeated_absence", header: "Repeated absence", render: (row) => (row.repeated_absence ? <Badge variant="warning">Yes</Badge> : "No") },
    { key: "absence_dates", header: "Absence dates", render: (row) => row.absence_dates?.join(", ") ?? "—" },
  ];

  return (
    <MainContent title="Absence Summary">
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
        <Card title="Absence summary" className="mt-4">
          {data && (
            <>
              <p className="text-sm text-theme-muted">
                Period: {data.period.start} to {data.period.end} — Total incidents: {data.summary.totalAbsenceIncidents} — Employees with absences: {data.summary.employeesWithAbsences}
              </p>
              <div className="mt-4">
                {data.employees.length === 0 ? (
                  <EmptyState message="No absences in this period" />
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
