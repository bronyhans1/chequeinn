"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canAccessAdminFeatures, canAccessCompanyPayroll } from "@/lib/auth/roles";
import * as payrollApi from "@/lib/api/payroll.api";
import * as companyPolicyApi from "@/lib/api/companyPolicy.api";
import { isApiError } from "@/lib/types/api";
import type { PayrollRecord, PayrollReportResult, EarningsSummary } from "@/lib/api/payroll.api";
import { formatCurrency } from "@/lib/utils/formatCurrency";

function statusBadge(status: string | undefined) {
  if (!status) return "—";
  const s = status.toLowerCase();
  if (s === "approved") return <Badge variant="success">Approved</Badge>;
  if (s === "locked") return <Badge variant="default">Locked</Badge>;
  return <Badge variant="warning">Draft</Badge>;
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-callout rounded-lg px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-theme-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-theme">{value}</p>
    </div>
  );
}

/** Aligns with backend payrollRecordEarningsBreakdown for display-only rows. */
function payrollRowBreakdown(r: PayrollRecord): { base: number; late: number; net: number } {
  const net = r.gross_earnings;
  const late =
    typeof r.late_deduction_amount === "number" && r.late_deduction_amount > 0
      ? r.late_deduction_amount
      : 0;
  const hasBase =
    typeof r.gross_before_late_deduction === "number" && !Number.isNaN(r.gross_before_late_deduction);
  const base = hasBase ? r.gross_before_late_deduction! : net + late;
  return { base, late, net };
}

export default function PayrollPage() {
  const { user } = useAuth();
  const payrollEnabled = user?.payrollEnabled !== false;
  const canCompanyPayroll = canAccessCompanyPayroll(user?.roles);
  const showPayrollSettingsLink = canAccessAdminFeatures(user?.roles);

  const [myData, setMyData] = useState<PayrollReportResult | null>(null);
  const [companyData, setCompanyData] = useState<PayrollReportResult | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [currencyCode, setCurrencyCode] = useState<"GHS" | "USD">("GHS");
  const [earningsError, setEarningsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [payslipLoading, setPayslipLoading] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);

  async function loadMyPayroll() {
    setMyError(null);
    try {
      const res = await payrollApi.getMyPayroll();
      if (isApiError(res)) {
        setMyError(res.error);
        setMyData(null);
        return;
      }
      setMyData(res.data ?? null);
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Failed to load payroll");
      setMyData(null);
    }
  }

  async function loadEarnings() {
    setEarningsError(null);
    try {
      const res = await payrollApi.getMyEarningsSummary();
      if (isApiError(res)) {
        setEarningsError(res.error);
        setEarnings(null);
        return;
      }
      setEarnings(res.data ?? null);
    } catch (e) {
      setEarningsError(e instanceof Error ? e.message : "Failed to load earnings");
      setEarnings(null);
    }
  }

  async function loadPolicyCurrency() {
    try {
      const res = await companyPolicyApi.getPolicy();
      if (isApiError(res)) return;
      const code = res.data?.currency_code;
      if (code === "USD" || code === "GHS") setCurrencyCode(code);
    } catch {
      // Leave default.
    }
  }

  async function loadCompanyPayroll() {
    if (!canCompanyPayroll) return;
    setCompanyError(null);
    try {
      const res = await payrollApi.getCompanyPayroll();
      if (isApiError(res)) {
        setCompanyError(res.error);
        setCompanyData(null);
        return;
      }
      setCompanyData(res.data ?? null);
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : "Failed to load company payroll");
      setCompanyData(null);
    }
  }

  async function load() {
    setLoading(true);
    await Promise.all([loadMyPayroll(), loadCompanyPayroll(), loadEarnings(), loadPolicyCurrency()]);
    setLoading(false);
  }

  useEffect(() => {
    if (!payrollEnabled) return;
    load();
  }, [canCompanyPayroll, payrollEnabled]);

  async function handlePayslip(id: string) {
    setPayslipLoading(id);
    try {
      const result = await payrollApi.downloadPayslip(id);
      if (!result.ok) alert(result.error ?? "Download failed");
    } finally {
      setPayslipLoading(null);
    }
  }

  async function handleExportCsv() {
    setExportLoading("csv");
    try {
      const result = await payrollApi.downloadPayrollCsv(exportYear, exportMonth);
      if (!result.ok) alert(result.error ?? "Export failed");
    } finally {
      setExportLoading(null);
    }
  }

  async function handleExportExcel() {
    setExportLoading("excel");
    try {
      const result = await payrollApi.downloadPayrollExcel(exportYear, exportMonth);
      if (!result.ok) alert(result.error ?? "Export failed");
    } finally {
      setExportLoading(null);
    }
  }

  const showLateInRecords = useMemo(() => {
    const anyLate = (recs: PayrollRecord[] | undefined) =>
      (recs ?? []).some((r) => (r.late_deduction_amount ?? 0) > 0);
    return anyLate(myData?.records) || anyLate(companyData?.records);
  }, [myData?.records, companyData?.records]);

  const lateAmountColumns = useMemo(
    () =>
      showLateInRecords
        ? ([
            {
              key: "base_before_late",
              header: "Base",
              render: (r: PayrollRecord) => formatCurrency(payrollRowBreakdown(r).base, currencyCode),
            },
            {
              key: "late_deduction",
              header: "Late",
              render: (r: PayrollRecord) => {
                const { late } = payrollRowBreakdown(r);
                return late > 0 ? `−${formatCurrency(late, currencyCode)}` : "—";
              },
            },
          ] as const)
        : [],
    [showLateInRecords, currencyCode]
  );

  const myColumns = useMemo(
    () => [
      { key: "payroll_date", header: "Payroll date", render: (r: PayrollRecord) => r.payroll_date },
      { key: "hours_worked", header: "Hours", render: (r: PayrollRecord) => r.hours_worked ?? "—" },
      { key: "regular_minutes", header: "Regular (min)", render: (r: PayrollRecord) => r.regular_minutes ?? "—" },
      { key: "overtime_minutes", header: "Overtime (min)", render: (r: PayrollRecord) => r.overtime_minutes ?? "—" },
      {
        key: "hourly_rate",
        header: "Rate",
        render: (r: PayrollRecord) => (r.hourly_rate != null ? formatCurrency(r.hourly_rate, currencyCode) : "—"),
      },
      ...lateAmountColumns,
      {
        key: "gross_earnings",
        header: showLateInRecords ? "Payable" : "Gross",
        render: (r: PayrollRecord) => formatCurrency(r.gross_earnings, currencyCode),
      },
      { key: "status", header: "Status", render: (r: PayrollRecord) => statusBadge(r.status) },
      {
        key: "payslip",
        header: "",
        render: (r: PayrollRecord) => (
          <button
            type="button"
            onClick={() => handlePayslip(r.id)}
            disabled={payslipLoading !== null}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
          >
            {payslipLoading === r.id ? "…" : "Payslip"}
          </button>
        ),
      },
    ],
    [currencyCode, lateAmountColumns, payslipLoading, showLateInRecords]
  );

  const companyColumns = useMemo(
    () => [
      {
        key: "user_id",
        header: "User",
        render: (r: PayrollRecord) => {
          const fallbackId = r.user_id.slice(0, 8) + "…";
          const displayBase = r.employee_name ?? r.employee_email ?? fallbackId;
          return (
            <span
              className="text-theme-muted"
              title={
                r.employee_name && r.employee_email
                  ? `${r.employee_name} (${r.employee_email})`
                  : r.employee_name ?? r.employee_email ?? r.user_id
              }
            >
              {displayBase}
              {r.employee_name && r.employee_email ? (
                <span className="ml-2 opacity-70">({r.employee_email})</span>
              ) : null}
            </span>
          );
        },
      },
      { key: "payroll_date", header: "Payroll date", render: (r: PayrollRecord) => r.payroll_date },
      { key: "hours_worked", header: "Hours", render: (r: PayrollRecord) => r.hours_worked ?? "—" },
      { key: "regular_minutes", header: "Regular (min)", render: (r: PayrollRecord) => r.regular_minutes ?? "—" },
      { key: "overtime_minutes", header: "Overtime (min)", render: (r: PayrollRecord) => r.overtime_minutes ?? "—" },
      {
        key: "hourly_rate",
        header: "Rate",
        render: (r: PayrollRecord) => (r.hourly_rate != null ? formatCurrency(r.hourly_rate, currencyCode) : "—"),
      },
      ...lateAmountColumns,
      {
        key: "gross_earnings",
        header: showLateInRecords ? "Payable" : "Gross",
        render: (r: PayrollRecord) => formatCurrency(r.gross_earnings, currencyCode),
      },
      { key: "status", header: "Status", render: (r: PayrollRecord) => statusBadge(r.status) },
    ],
    [currencyCode, lateAmountColumns, showLateInRecords]
  );

  if (!payrollEnabled) {
    return (
      <MainContent title="Payroll">
        <Card>
          <p className="text-sm text-theme">
            Payroll is turned off for this company. Enable payroll in Settings to use payroll features.
          </p>
          {showPayrollSettingsLink ? (
            <p className="mt-4">
              <Link
                href="/settings"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Open Settings
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-sm text-theme-muted">
              If you need payroll access, ask your company admin to enable it in Settings.
            </p>
          )}
        </Card>
      </MainContent>
    );
  }

  if (loading && !myData && !companyData) {
    return (
      <MainContent title="Payroll">
        <LoadingState message="Loading payroll…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  return (
    <MainContent title="Payroll">
      <h2 className="text-base font-semibold text-theme">Earnings</h2>
      <Card className="mt-2">
        {earningsError ? (
          <ErrorState message={earningsError} onRetry={loadEarnings} />
        ) : !earnings ? (
          <EmptyState message="No earnings data yet." />
        ) : earnings.rate_type === "none" ? (
          <p className="text-sm text-theme-muted">
            No compensation profile on file. When admin or HR assigns an hourly or monthly rate, your earnings will
            appear here.
          </p>
        ) : (
          <>
            {earnings.earnings_period_label ? (
              <p className="mb-3 text-xs text-theme-muted">{earnings.earnings_period_label}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatMini
                label={earnings.calendar_today ? `Today · ${earnings.calendar_today}` : "Today"}
                value={formatCurrency(earnings.today_earned, currencyCode)}
              />
              <StatMini label="This month" value={formatCurrency(earnings.month_earned_total, currencyCode)} />
              <StatMini
                label={earnings.rate_type === "monthly" ? "Expected salary" : "Rate type"}
                value={
                  earnings.rate_type === "monthly" && earnings.expected_monthly_salary != null
                    ? formatCurrency(earnings.expected_monthly_salary, currencyCode)
                    : earnings.rate_type === "hourly"
                      ? "Hourly"
                      : "—"
                }
              />
              <StatMini
                label="Paid days"
                value={earnings.rate_type === "monthly" ? String(earnings.paid_days) : "—"}
              />
              <StatMini
                label="Unpaid days"
                value={earnings.rate_type === "monthly" ? String(earnings.unpaid_days) : "—"}
              />
              <StatMini
                label="Payable days (month)"
                value={earnings.rate_type === "monthly" ? String(earnings.payable_days_in_month) : "—"}
              />
            </div>
            {(earnings.month_late_deduction_total ?? 0) > 0 || (earnings.today_late_deduction ?? 0) > 0 ? (
              <div className="callout-warning mt-4 space-y-1 px-3 py-3 text-xs">
                <p className="font-semibold uppercase tracking-wide">
                  Late pay deduction (transparent view)
                </p>
                <p className="opacity-90">
                  Base is earnings before lateness deduction; payable matches payroll records (after deduction).
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatMini
                    label="Today — base"
                    value={formatCurrency(earnings.today_base_before_late ?? earnings.today_earned, currencyCode)}
                  />
                  <StatMini
                    label="Today — late"
                    value={
                      (earnings.today_late_deduction ?? 0) > 0
                        ? `−${formatCurrency(earnings.today_late_deduction ?? 0, currencyCode)}`
                        : formatCurrency(0, currencyCode)
                    }
                  />
                  <StatMini
                    label="Today — payable"
                    value={formatCurrency(earnings.today_earned, currencyCode)}
                  />
                  <StatMini
                    label="Month — base"
                    value={formatCurrency(earnings.month_base_before_late ?? earnings.month_earned_total, currencyCode)}
                  />
                  <StatMini
                    label="Month — late"
                    value={
                      (earnings.month_late_deduction_total ?? 0) > 0
                        ? `−${formatCurrency(earnings.month_late_deduction_total ?? 0, currencyCode)}`
                        : formatCurrency(0, currencyCode)
                    }
                  />
                  <StatMini
                    label="Month — payable"
                    value={formatCurrency(earnings.month_earned_total, currencyCode)}
                  />
                </div>
              </div>
            ) : null}
            {earnings.rate_type === "monthly" && earnings.daily_rate != null ? (
              <p className="mt-3 text-xs text-theme-muted">
                Daily rate {formatCurrency(earnings.daily_rate, currencyCode)}
                {earnings.divisor_type === "dynamic_working_days"
                  ? " (monthly ÷ payable working + paid holidays)"
                  : ` (monthly ÷ ${earnings.divisor_type === "fixed_days" ? "fixed" : ""} divisor)`}
              </p>
            ) : null}
            {earnings.daily_history.length > 0 ? (
              <div
                className="mt-4 max-h-48 overflow-auto rounded-md border"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <table className="min-w-full text-sm text-theme">
                  <thead
                    className="sticky top-0 text-left text-xs font-semibold"
                    style={{ background: "var(--surface-muted)", color: "var(--text-muted)" }}
                  >
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      {(earnings.month_late_deduction_total ?? 0) > 0 ||
                      earnings.daily_history.some((row) => (row.late_deduction ?? 0) > 0) ? (
                        <>
                          <th className="px-3 py-2 text-right">Base</th>
                          <th className="px-3 py-2 text-right">Late</th>
                          <th className="px-3 py-2 text-right">Payable</th>
                        </>
                      ) : (
                        <th className="px-3 py-2 text-right">Gross</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.daily_history.map((row) => {
                      const late = row.late_deduction ?? 0;
                      const base = row.base_before_late ?? row.gross;
                      const showCols =
                        (earnings.month_late_deduction_total ?? 0) > 0 ||
                        earnings.daily_history.some((d) => (d.late_deduction ?? 0) > 0);
                      return (
                        <tr key={row.date} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                          <td className="px-3 py-1.5">{row.date}</td>
                          {showCols ? (
                            <>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {formatCurrency(base, currencyCode)}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {late > 0 ? `−${formatCurrency(late, currencyCode)}` : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {formatCurrency(row.gross, currencyCode)}
                              </td>
                            </>
                          ) : (
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {formatCurrency(row.gross, currencyCode)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {/* My payroll — all users */}
      <h2 className="mt-8 text-base font-semibold text-theme">My payroll records</h2>
      <Card className="mt-2">
        {myError ? (
          <ErrorState message={myError} onRetry={loadMyPayroll} />
        ) : !myData || myData.records.length === 0 ? (
          <EmptyState message="No payroll records yet." />
        ) : (
          <>
            <p className="mb-3 text-sm text-theme-muted">
              Total hours: {myData.total_hours ?? 0} — Total payable:{" "}
              {formatCurrency(myData.total_gross_pay ?? 0, currencyCode)}
              {(myData.total_late_deduction ?? 0) > 0 ? (
                <>
                  {" "}
                  (base {formatCurrency(myData.total_base_before_late ?? myData.total_gross_pay, currencyCode)}
                  {" — "}
                  late −{formatCurrency(myData.total_late_deduction, currencyCode)})
                </>
              ) : null}
            </p>
            <DataTable
              columns={myColumns}
              data={myData.records}
              keyExtractor={(r) => r.id}
              emptyMessage="No records"
            />
          </>
        )}
      </Card>

      {/* Company payroll + export — admin / HR */}
      {canCompanyPayroll && (
        <>
          <h2 className="mt-8 text-base font-semibold text-theme">Company payroll</h2>
          <Card className="mt-2">
            {companyError ? (
              <ErrorState message={companyError} onRetry={loadCompanyPayroll} />
            ) : !companyData || companyData.records.length === 0 ? (
              <EmptyState message="No company payroll records." />
            ) : (
              <>
                <p className="mb-3 text-sm text-theme-muted">
                  Total hours: {companyData.total_hours ?? 0} — Total payable:{" "}
                  {formatCurrency(companyData.total_gross_pay ?? 0, currencyCode)}
                  {(companyData.total_late_deduction ?? 0) > 0 ? (
                    <>
                      {" "}
                      (base{" "}
                      {formatCurrency(
                        companyData.total_base_before_late ?? companyData.total_gross_pay,
                        currencyCode
                      )}
                      {" — "}
                      late −{formatCurrency(companyData.total_late_deduction, currencyCode)})
                    </>
                  ) : null}
                </p>
                <DataTable
                  columns={companyColumns}
                  data={companyData.records}
                  keyExtractor={(r) => r.id}
                  emptyMessage="No records"
                />
              </>
            )}
          </Card>

          {/* Export — CSV / Excel */}
          <Card title="Export payroll" className="mt-6">
            <p className="mb-3 text-sm text-theme-muted">Download payroll for a month (CSV or Excel).</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="export-year" className="mb-1 block text-xs font-medium text-theme-muted">Year</label>
                <input
                  id="export-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value) || new Date().getFullYear())}
                  className="input-field w-24 py-1.5"
                />
              </div>
              <div>
                <label htmlFor="export-month" className="mb-1 block text-xs font-medium text-theme-muted">Month</label>
                <select
                  id="export-month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(Number(e.target.value))}
                  className="input-field rounded-md py-1.5"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportLoading !== null}
                className="btn-secondary btn-secondary-sm"
              >
                {exportLoading === "csv" ? "…" : "Download CSV"}
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportLoading !== null}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {exportLoading === "excel" ? "…" : "Download Excel"}
              </button>
            </div>
          </Card>
        </>
      )}
    </MainContent>
  );
}
