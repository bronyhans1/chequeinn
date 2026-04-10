"use client";

import { useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import * as attendanceApi from "@/lib/api/attendance.api";
import { isApiError } from "@/lib/types/api";
import type { TodayOverview } from "@/lib/api/attendance.api";

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

export default function AttendancePage() {
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await attendanceApi.getTodayOverview();
      if (isApiError(res)) {
        setError(res.error);
        return;
      }
      setOverview(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !overview) {
    return (
      <MainContent title="Attendance Overview">
        <LoadingState message="Loading attendance…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent title="Attendance Overview">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Attendance Overview">
      <Card title="Today's summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Present"
            value={overview?.present ?? 0}
            subtitle="With a session today"
          />
          <StatCard
            title="Active"
            value={overview?.active ?? 0}
            subtitle="Currently clocked in"
          />
          <StatCard
            title="Completed"
            value={overview?.completed ?? 0}
            subtitle="Sessions ended"
          />
          <StatCard
            title="Total minutes"
            value={overview ? formatMinutes(overview.total_minutes_today) : "—"}
          />
          <StatCard title="Late today" value={overview?.late_today ?? 0} />
          <StatCard title="Overtime today" value={overview?.overtime_today ?? 0} />
          <StatCard title="Absent today" value={overview?.absent_today ?? 0} />
        </div>
      </Card>
    </MainContent>
  );
}
