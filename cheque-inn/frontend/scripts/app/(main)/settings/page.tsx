"use client";

import { useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/lib/auth/AuthContext";
import { canUpdateCompanyPolicy, canEditPayrollSchedulePolicy, canAccessAdminFeatures } from "@/lib/auth/roles";
import * as companyPolicyApi from "@/lib/api/companyPolicy.api";
import * as holidaysApi from "@/lib/api/holidays.api";
import { isApiError } from "@/lib/types/api";
import type { CompanyPolicy } from "@/lib/api/companyPolicy.api";
import type { CompanyHoliday } from "@/lib/api/holidays.api";

const WEEKDAY_OPTIONS: { v: number; label: string }[] = [
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
  { v: 7, label: "Sun" },
];

function normalizeWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) return [1, 2, 3, 4, 5];
  const nums = raw
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const uniq = Array.from(new Set(nums)).sort((a, b) => a - b);
  return uniq.length ? uniq : [1, 2, 3, 4, 5];
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const canEdit = canUpdateCompanyPolicy(user?.roles);
  const canEditSchedule = canEditPayrollSchedulePolicy(user?.roles);
  const canEditCurrency = canAccessAdminFeatures(user?.roles);

  const [policy, setPolicy] = useState<CompanyPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [defaultDailyHours, setDefaultDailyHours] = useState<number>(8);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState<number>(1.5);
  const [latenessTrackingEnabled, setLatenessTrackingEnabled] = useState(true);
  const [latePayDeductionEnabled, setLatePayDeductionEnabled] = useState(false);
  const [workingWeekdays, setWorkingWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [currencyCode, setCurrencyCode] = useState<"GHS" | "USD">("GHS");
  const [payrollEnabled, setPayrollEnabled] = useState(true);
  const [businessTimezone, setBusinessTimezone] = useState("UTC");
  const [attendanceDayClassificationEnabled, setAttendanceDayClassificationEnabled] = useState(false);
  const [minMinutesCounted, setMinMinutesCounted] = useState(60);
  const [fullDayMinutes, setFullDayMinutes] = useState(480);
  /** Server: cannot turn payroll off when records or wage rows exist. */
  const [payrollDisableBlocked, setPayrollDisableBlocked] = useState(false);

  const [holidayYear, setHolidayYear] = useState(() => new Date().getFullYear());
  const [holidayMonth, setHolidayMonth] = useState(() => new Date().getMonth() + 1);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayPaid, setHolidayPaid] = useState(true);
  const [holidayBusy, setHolidayBusy] = useState(false);

  async function loadHolidays() {
    setHolidaysLoading(true);
    try {
      const res = await holidaysApi.listHolidays(holidayYear, holidayMonth);
      if (isApiError(res)) {
        setHolidays([]);
        return;
      }
      setHolidays(res.data ?? []);
    } catch {
      setHolidays([]);
    } finally {
      setHolidaysLoading(false);
    }
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await companyPolicyApi.getPolicy();
      if (isApiError(res)) {
        setError(res.error);
        setPolicy(null);
        return;
      }
      const p = res.data;
      setPolicy(p);
      if (p) {
        setDefaultDailyHours(p.default_daily_hours);
        setOvertimeMultiplier(p.overtime_multiplier);
        setLatenessTrackingEnabled(p.lateness_tracking_enabled !== false);
        setLatePayDeductionEnabled(p.late_pay_deduction_enabled === true);
        setWorkingWeekdays(normalizeWeekdays(p.working_weekdays));
        if (p.currency_code === "USD" || p.currency_code === "GHS") setCurrencyCode(p.currency_code);
        setPayrollEnabled(p.payroll_enabled !== false);
        setPayrollDisableBlocked(p.payroll_disable_blocked === true);
        if (typeof p.business_timezone === "string" && p.business_timezone.trim()) {
          setBusinessTimezone(p.business_timezone.trim());
        }
        setAttendanceDayClassificationEnabled(p.attendance_day_classification_enabled === true);
        if (typeof p.minimum_minutes_for_counted_day === "number") setMinMinutesCounted(p.minimum_minutes_for_counted_day);
        if (typeof p.full_day_minutes_threshold === "number") setFullDayMinutes(p.full_day_minutes_threshold);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policy");
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    void loadHolidays();
  }, [holidayYear, holidayMonth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaveError(null);
    setSaveSuccess(false);
    const hours = Number(defaultDailyHours);
    const multiplier = Number(overtimeMultiplier);
    if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
      setSaveError("Default daily hours must be between 1 and 24.");
      return;
    }
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 3) {
      setSaveError("Overtime multiplier must be between 1 and 3.");
      return;
    }
    if (
      canEditCurrency &&
      attendanceDayClassificationEnabled &&
      fullDayMinutes < minMinutesCounted
    ) {
      setSaveError("Full-day threshold must be greater than or equal to minimum counted minutes.");
      return;
    }
    setSaving(true);
    try {
      const res = await companyPolicyApi.updatePolicy({
        default_daily_hours: hours,
        overtime_multiplier: multiplier,
        lateness_tracking_enabled: latenessTrackingEnabled,
        late_pay_deduction_enabled: latePayDeductionEnabled,
        ...(canEditCurrency
          ? {
              currency_code: currencyCode,
              payroll_enabled: payrollEnabled,
              business_timezone: businessTimezone.trim() || "UTC",
              attendance_day_classification_enabled: attendanceDayClassificationEnabled,
              minimum_minutes_for_counted_day: minMinutesCounted,
              full_day_minutes_threshold: fullDayMinutes,
            }
          : {}),
        ...(canEditSchedule ? { working_weekdays: workingWeekdays } : {}),
      });
      if (isApiError(res)) {
        setSaveError(res.error ?? "Failed to update policy");
        return;
      }
      const saved = res.data ?? null;
      setPolicy(saved);
      if (saved?.working_weekdays) setWorkingWeekdays(normalizeWeekdays(saved.working_weekdays));
      if (saved?.currency_code === "USD" || saved?.currency_code === "GHS") setCurrencyCode(saved.currency_code);
      if (saved) {
        setPayrollEnabled(saved.payroll_enabled !== false);
        setPayrollDisableBlocked(saved.payroll_disable_blocked === true);
        setLatenessTrackingEnabled(saved.lateness_tracking_enabled !== false);
        setLatePayDeductionEnabled(saved.late_pay_deduction_enabled === true);
        if (typeof saved.business_timezone === "string" && saved.business_timezone.trim()) {
          setBusinessTimezone(saved.business_timezone.trim());
        }
        setAttendanceDayClassificationEnabled(saved.attendance_day_classification_enabled === true);
        if (typeof saved.minimum_minutes_for_counted_day === "number") setMinMinutesCounted(saved.minimum_minutes_for_counted_day);
        if (typeof saved.full_day_minutes_threshold === "number") setFullDayMinutes(saved.full_day_minutes_threshold);
      }
      await refreshUser();
      setSaveSuccess(true);
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update policy");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !policy) {
    return (
      <MainContent title="Settings">
        <LoadingState message="Loading settings…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent title="Settings">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Settings">
      <Card title="Company policy">
        <p className="mb-4 text-sm text-theme-muted">
          Attendance and payroll policy for your company. Hours and overtime can be edited by admin and manager;
          working week and holidays (used for monthly salary) by admin and HR.
        </p>
        {saveSuccess && (
          <div className="alert-success mb-4 px-3 py-2">Policy saved successfully.</div>
        )}
        {saveError && (
          <div className="alert-error mb-4 px-3 py-2">{saveError}</div>
        )}
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          {canEditCurrency ? (
            <div className="surface-callout rounded-lg p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={payrollEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (!next && payrollDisableBlocked) {
                      setSaveError(
                        "Payroll cannot be turned off after payroll data or salary assignments already exist for this company."
                      );
                      return;
                    }
                    setSaveError(null);
                    setPayrollEnabled(next);
                  }}
                  disabled={!canEdit}
                  className="mt-1 h-4 w-4 rounded border border-[color:var(--border-soft)] disabled:opacity-50"
                />
                <span>
                  <span className="block text-sm font-medium text-theme">Enable payroll</span>
                  <span className="mt-0.5 block text-xs text-theme-muted">
                    When off, the company runs in attendance-only mode: no earnings, wage rates, or payroll exports.
                    Only company admin can change this. You cannot turn payroll off after payroll records or wage
                    assignments exist—remove those first or contact support if you need a reset.
                  </span>
                  {payrollDisableBlocked && payrollEnabled ? (
                    <div className="callout-warning mt-2 text-xs font-medium" role="note">
                      Payroll cannot be turned off while this company has payroll data or salary/wage assignments.
                    </div>
                  ) : null}
                </span>
              </label>
            </div>
          ) : null}
          {canEditCurrency ? (
            <div>
              <label htmlFor="currency_code" className="mb-1 block text-sm font-medium text-theme">
                Currency
              </label>
              <select
                id="currency_code"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value as "GHS" | "USD")}
                disabled={!canEdit}
                className="input-field w-full"
              >
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
              </select>
              <p className="mt-1 text-xs text-theme-muted">
                Changing currency after payroll data exists is not allowed.
              </p>
            </div>
          ) : null}
          {canEditCurrency ? (
            <div>
              <label htmlFor="business_timezone" className="mb-1 block text-sm font-medium text-theme">
                Business time zone (IANA)
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={businessTimezone}
                  onChange={(e) => setBusinessTimezone(e.target.value)}
                  disabled={!canEdit}
                  className="input-field flex-1 min-w-[220px]"
                  aria-label="Business time zone presets"
                >
                  <option value="Africa/Accra">Africa/Accra (Ghana)</option>
                  <option value="UTC">UTC</option>
                  <option value="Africa/Lagos">Africa/Lagos</option>
                  <option value="Africa/Nairobi">Africa/Nairobi</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
                <input
                  id="business_timezone"
                  type="text"
                  value={businessTimezone}
                  onChange={(e) => setBusinessTimezone(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Custom, e.g. Africa/Accra"
                  className="input-field flex-1 min-w-[220px]"
                />
              </div>
              <p className="mt-1 text-xs text-theme-muted">
                Used for earnings “today” and calendar month boundaries. Invalid names fall back to UTC on the server.
              </p>
            </div>
          ) : null}
          {canEditCurrency ? (
            <div className="surface-callout rounded-lg p-4">
              <p className="text-sm font-medium text-theme">Salary day classification (fairness)</p>
              <p className="mt-1 text-xs text-theme-muted">
                Completed sessions are grouped by calendar day and classified by total worked minutes:
                below minimum = 0.0, at/above minimum = 0.5, at/above full-day = 1.0. Incomplete sessions (no clock-out) never count.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={attendanceDayClassificationEnabled}
                  onChange={(e) => setAttendanceDayClassificationEnabled(e.target.checked)}
                  disabled={!canEdit}
                  className="mt-1 h-4 w-4 rounded border border-[color:var(--border-soft)] disabled:opacity-50"
                />
                <span>
                  <span className="block text-sm font-medium text-theme">Enable attendance day classification</span>
                  <span className="mt-0.5 block text-xs text-theme-muted">
                    When off, monthly salary uses legacy behavior (any completed attendance on a working day credits a full day).
                    Overrides can still be applied per day.
                  </span>
                </span>
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-theme-muted">
                    Minimum minutes (counted)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    step={1}
                    value={minMinutesCounted}
                    onChange={(e) => setMinMinutesCounted(Number(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-theme-muted">
                    Full-day threshold (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    step={1}
                    value={fullDayMinutes}
                    onChange={(e) => setFullDayMinutes(Number(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-theme-muted">
                Tip: common defaults are 60 minutes minimum and 480 minutes (8h) for a full day; half-day credit is automatic
                between those values when classification is on.
              </p>
            </div>
          ) : null}
          <div>
            <label htmlFor="default_daily_hours" className="mb-1 block text-sm font-medium text-theme">
              Default daily hours
            </label>
            <input
              id="default_daily_hours"
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={defaultDailyHours}
              onChange={(e) => setDefaultDailyHours(Number(e.target.value) || 8)}
              disabled={!canEdit}
              className="input-field w-full"
            />
            <p className="mt-0.5 text-xs text-theme-muted">Used for regular vs overtime split (1–24).</p>
          </div>
          <div>
            <label htmlFor="overtime_multiplier" className="mb-1 block text-sm font-medium text-theme">
              Overtime multiplier
            </label>
            <input
              id="overtime_multiplier"
              type="number"
              min={1}
              max={3}
              step={0.1}
              value={overtimeMultiplier}
              onChange={(e) => setOvertimeMultiplier(Number(e.target.value) || 1.5)}
              disabled={!canEdit}
              className="input-field w-full"
            />
            <p className="mt-0.5 text-xs text-theme-muted">e.g. 1.5 for time-and-a-half (1–3).</p>
          </div>
          <div className="surface-callout space-y-3 p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                id="lateness_tracking_enabled"
                type="checkbox"
                checked={latenessTrackingEnabled}
                onChange={(e) => setLatenessTrackingEnabled(e.target.checked)}
                disabled={!canEdit}
                className="mt-1 h-4 w-4 rounded border border-[color:var(--border-soft)] disabled:opacity-50"
              />
              <span>
                <span className="text-sm font-medium text-theme">Enable lateness tracking</span>
                <span className="mt-0.5 block text-xs text-theme-muted">
                  Records how many minutes late each clock-in is (after shift start and grace). Used in attendance
                  reports and alerts. When off, late minutes are not stored.
                </span>
              </span>
            </label>
            <label className={`flex items-start gap-2 ${payrollEnabled ? "cursor-pointer" : "opacity-60"}`}>
              <input
                id="late_pay_deduction_enabled"
                type="checkbox"
                checked={latePayDeductionEnabled}
                onChange={(e) => setLatePayDeductionEnabled(e.target.checked)}
                disabled={!canEdit || !payrollEnabled}
                className="mt-1 h-4 w-4 rounded border border-[color:var(--border-soft)] disabled:opacity-50"
              />
              <span>
                <span className="text-sm font-medium text-theme">Enable late pay deduction</span>
                <span className="mt-0.5 block text-xs text-theme-muted">
                  When payroll is on, reduces session and salary earnings by the time value of recorded late minutes
                  (same hourly rate as normal pay; monthly workers use daily rate ÷ default daily hours). Requires
                  lateness tracking so late minutes exist on sessions.
                </span>
                {!payrollEnabled ? (
                  <div className="callout-warning mt-2 text-xs font-medium" role="note">
                    Turn on payroll above to use pay deductions.
                  </div>
                ) : null}
              </span>
            </label>
          </div>

          <div className="rounded-md border border-dashed p-3" style={{ borderColor: "var(--border-soft)" }}>
            <p className="text-sm font-medium text-theme">Working week (monthly salary)</p>
            <p className="mt-1 text-xs text-theme-muted">
              Days counted for payable-days divisor. Weekends are excluded unless you add them here.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {WEEKDAY_OPTIONS.map((d) => (
                <label key={d.v} className="flex cursor-pointer items-center gap-2 text-sm text-theme">
                  <input
                    type="checkbox"
                    checked={workingWeekdays.includes(d.v)}
                    disabled={!canEdit || !canEditSchedule}
                    onChange={(e) => {
                      if (!canEditSchedule) return;
                      if (e.target.checked) {
                        setWorkingWeekdays(Array.from(new Set([...workingWeekdays, d.v])).sort((a, b) => a - b));
                      } else {
                        setWorkingWeekdays(workingWeekdays.filter((x) => x !== d.v));
                      }
                    }}
                    className="h-4 w-4 rounded border border-[color:var(--border-soft)] disabled:opacity-50"
                  />
                  {d.label}
                </label>
              ))}
            </div>
            {!canEditSchedule && (
              <p className="mt-2 text-xs text-theme-muted">Only admin or HR can change this schedule.</p>
            )}
          </div>

          {canEdit && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
          {!canEdit && (
            <p className="text-sm text-theme-muted">You can only view policy. Ask an admin or manager to edit.</p>
          )}
        </form>
      </Card>

      <Card title="Company holidays" className="mt-6">
        <p className="mb-3 text-sm text-theme-muted">
          Paid holidays count as payable days for monthly salary. Unpaid holidays are excluded from the divisor.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-theme-muted" htmlFor="holiday-year">
              Year
            </label>
            <input
              id="holiday-year"
              type="number"
              min={2000}
              max={2100}
              value={holidayYear}
              onChange={(e) => setHolidayYear(Number(e.target.value) || holidayYear)}
              className="input-field w-24 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-theme-muted" htmlFor="holiday-month">
              Month
            </label>
            <select
              id="holiday-month"
              value={holidayMonth}
              onChange={(e) => setHolidayMonth(Number(e.target.value))}
              className="input-field rounded-md py-1.5"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canEditSchedule ? (
          <form className="surface-callout mb-4 grid gap-3 p-3 sm:grid-cols-2"
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!holidayName.trim() || !holidayDate.trim()) return;
              setHolidayBusy(true);
              try {
                const res = await holidaysApi.createHoliday({
                  holiday_date: holidayDate.trim(),
                  name: holidayName.trim(),
                  is_paid: holidayPaid,
                });
                if (isApiError(res)) {
                  alert(res.error);
                  return;
                }
                setHolidayName("");
                setHolidayDate("");
                await loadHolidays();
              } finally {
                setHolidayBusy(false);
              }
            }}
          >
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-theme-muted">Date</label>
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="input-field mt-1 w-full py-1.5"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-theme-muted">Name</label>
              <input
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                className="input-field mt-1 w-full py-1.5"
                placeholder="e.g. Independence Day"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-theme">
              <input
                type="checkbox"
                checked={holidayPaid}
                onChange={(e) => setHolidayPaid(e.target.checked)}
              />
              Paid holiday
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={holidayBusy}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {holidayBusy ? "…" : "Add holiday"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mb-3 text-xs text-theme-muted">Only admin or HR can add or remove holidays.</p>
        )}

        {holidaysLoading ? (
          <p className="text-sm text-theme-muted">Loading holidays…</p>
        ) : holidays.length === 0 ? (
          <p className="text-sm text-theme-muted">No holidays for this month.</p>
        ) : (
          <ul
            className="divide-y divide-[color:var(--border-soft)] rounded-md border"
            style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
          >
            {holidays.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-theme">
                  {h.holiday_date} — {h.name}{" "}
                  <span className="text-theme-muted">({h.is_paid ? "paid" : "unpaid"})</span>
                </span>
                {canEditSchedule ? (
                  <button
                    type="button"
                    className="text-red-600 hover:underline dark:text-red-400"
                    onClick={async () => {
                      if (!confirm("Remove this holiday?")) return;
                      const res = await holidaysApi.deleteHoliday(h.id);
                      if (isApiError(res)) {
                        alert(res.error);
                        return;
                      }
                      await loadHolidays();
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </MainContent>
  );
}
