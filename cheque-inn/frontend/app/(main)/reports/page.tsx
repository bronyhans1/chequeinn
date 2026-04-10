"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { canAccessManagerFeatures } from "@/lib/auth/roles";
import { getCurrentMonthRange, getYearMonthPreset } from "@/lib/utils/date";
import * as attendanceApi from "@/lib/api/attendance.api";
import * as payrollApi from "@/lib/api/payroll.api";
import { ReportDatePresetButtons } from "@/components/ui/ReportDatePresetButtons";
import { ExportSuccessNotice } from "@/components/ui/ExportSuccessNotice";

function currentYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function ReportsPage() {
  const { user } = useAuth();
  const allowed = canAccessManagerFeatures(user?.roles);
  const payrollEnabled = user?.payrollEnabled !== false;

  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const { year: defaultYear, month: defaultMonth } = useMemo(currentYearMonth, []);

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [attendanceLoading, setAttendanceLoading] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceExportOk, setAttendanceExportOk] = useState<string | null>(null);

  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [payrollLoading, setPayrollLoading] = useState<string | null>(null);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payrollExportOk, setPayrollExportOk] = useState<string | null>(null);

  async function runAttendanceExport(kind: "lateness" | "flags" | "absence") {
    setAttendanceError(null);
    if (!start || !end) {
      setAttendanceError("Start date and end date are required.");
      return;
    }
    setAttendanceLoading(kind);
    try {
      const fn =
        kind === "lateness"
          ? attendanceApi.downloadLatenessSummaryExcel
          : kind === "flags"
            ? attendanceApi.downloadFlagsSummaryExcel
            : attendanceApi.downloadAbsenceSummaryExcel;
      const result = await fn(start, end);
      if (!result.ok) {
        setAttendanceError(result.error ?? "Download failed");
      }
    } finally {
      setAttendanceLoading(null);
    }
  }

  async function runPayrollExport(kind: "csv" | "excel") {
    setPayrollError(null);
    setPayrollExportOk(null);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setPayrollError("Please enter a valid year (2000–2100).");
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      setPayrollError("Please select a valid month (1–12).");
      return;
    }
    setPayrollLoading(kind);
    try {
      const result =
        kind === "csv"
          ? await payrollApi.downloadPayrollCsv(year, month)
          : await payrollApi.downloadPayrollExcel(year, month);
      if (!result.ok) {
        setPayrollError(result.error ?? "Export failed");
      } else {
        setPayrollExportOk("Download started — check your browser’s downloads folder.");
      }
    } finally {
      setPayrollLoading(null);
    }
  }
  return (
    <MainContent title="Reports & Exports">
      {!allowed ? (
        <EmptyState message="Reports are available to admin, manager, and HR roles." />
      ) : (
        <div className="space-y-6">
          <Card title="Operational reports (sessions & leave)">
            <p className="mb-4 text-sm text-theme-muted">
              Browse and export detailed attendance sessions and leave requests with filters. Managers
              and HR see their branch only; admins can narrow by branch.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/reports/attendance"
                className="inline-flex rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Attendance report
              </Link>
              <Link
                href="/reports/leave"
                className="btn-secondary btn-secondary-sm inline-flex"
              >
                Leave report
              </Link>
            </div>
          </Card>

          <Card title="Attendance summaries (Excel)">
            <p className="mb-4 text-sm text-theme-muted">
              Export attendance intelligence summaries as Excel files for a selected period. Large
              exports may be capped on the server — if the file includes a truncation notice, narrow
              the date range and export again.
            </p>
            <ReportDatePresetButtons
              className="mb-3"
              disabled={attendanceLoading !== null}
              onSelect={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
            <DateRangeFilter
              start={start}
              end={end}
              onStartChange={setStart}
              onEndChange={setEnd}
              onApply={() => {}}
              loading={false}
              showApply={false}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runAttendanceExport("lateness")}
                disabled={attendanceLoading !== null}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {attendanceLoading === "lateness" ? "Downloading…" : "Lateness Summary (Excel)"}
              </button>
              <button
                type="button"
                onClick={() => runAttendanceExport("flags")}
                disabled={attendanceLoading !== null}
                className="btn-secondary btn-secondary-sm disabled:opacity-50"
              >
                {attendanceLoading === "flags" ? "Downloading…" : "Attendance Flags (Excel)"}
              </button>
              <button
                type="button"
                onClick={() => runAttendanceExport("absence")}
                disabled={attendanceLoading !== null}
                className="btn-secondary btn-secondary-sm disabled:opacity-50"
              >
                {attendanceLoading === "absence" ? "Downloading…" : "Absence Summary (Excel)"}
              </button>
            </div>
            {attendanceError && (
              <div className="mt-4">
                <ErrorState message={attendanceError} />
              </div>
            )}
            <div className="mt-3">
              <ExportSuccessNotice message={attendanceExportOk} />
            </div>
          </Card>

          {payrollEnabled ? (
          <Card title="Payroll Reports">
            <p className="mb-4 text-sm text-theme-muted">
              Export monthly payroll as CSV or Excel.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-theme-muted">Quick select:</span>
              <button
                type="button"
                disabled={payrollLoading !== null}
                onClick={() => {
                  const m = getYearMonthPreset("this_month");
                  setYear(m.year);
                  setMonth(m.month);
                }}
                className="btn-preset disabled:opacity-50"
              >
                This month
              </button>
              <button
                type="button"
                disabled={payrollLoading !== null}
                onClick={() => {
                  const m = getYearMonthPreset("last_month");
                  setYear(m.year);
                  setMonth(m.month);
                }}
                className="btn-preset disabled:opacity-50"
              >
                Last month
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="reports-year" className="mb-1 block text-xs font-medium text-theme-muted">
                  Year
                </label>
                <input
                  id="reports-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
                  className="input-field w-24 py-1.5"
                />
              </div>
              <div>
                <label htmlFor="reports-month" className="mb-1 block text-xs font-medium text-theme-muted">
                  Month
                </label>
                <select
                  id="reports-month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="input-field rounded-md py-1.5"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => runPayrollExport("csv")}
                disabled={payrollLoading !== null}
                className="btn-secondary btn-secondary-sm disabled:opacity-50"
              >
                {payrollLoading === "csv" ? "Downloading…" : "Payroll CSV"}
              </button>
              <button
                type="button"
                onClick={() => runPayrollExport("excel")}
                disabled={payrollLoading !== null}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {payrollLoading === "excel" ? "Downloading…" : "Payroll Excel"}
              </button>
            </div>
            {payrollError && (
              <div className="mt-4">
                <ErrorState message={payrollError} />
              </div>
            )}
            <div className="mt-3">
              <ExportSuccessNotice message={payrollExportOk} />
            </div>
          </Card>
          ) : null}
        </div>
      )}
    </MainContent>
  );
}
