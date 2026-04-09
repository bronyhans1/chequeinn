import * as wageRepo from "../wageRates/wageRates.repository";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";
import { syncMonthlySalaryPayroll } from "./salaryEarnings.service";
import {
  ymTodayUtc,
  utcYearMonthFromCalendarDate,
  previousUtcYearMonth,
  dedupeYearMonths,
  mergeYearMonthLists,
  type IsoDate,
  type YearMonth,
} from "./salaryEarnings.engine";

export type { YearMonth };

/** Live dashboards use UTC; include prior month so edits near boundaries refresh last month too. */
export function utcBufferYearMonths(): YearMonth[] {
  const { year, month } = ymTodayUtc();
  return dedupeYearMonths([{ year, month }, previousUtcYearMonth(year, month)]);
}

async function resyncCompanyUsersForMonths(companyId: string, months: YearMonth[]): Promise<void> {
  if (months.length === 0) return;
  const payrollOn = await companyPolicyService.isPayrollEnabled(companyId);
  if (!payrollOn) return;
  const userIds = await wageRepo.listUserIdsWithAnyMonthlyWageRow(companyId);
  for (const { year, month } of months) {
    for (const userId of userIds) {
      await syncMonthlySalaryPayroll(userId, companyId, year, month);
    }
  }
}

async function resyncOneUserForMonths(userId: string, companyId: string, months: YearMonth[]): Promise<void> {
  const payrollOn = await companyPolicyService.isPayrollEnabled(companyId);
  if (!payrollOn) return;
  for (const { year, month } of months) {
    await syncMonthlySalaryPayroll(userId, companyId, year, month);
  }
}

/**
 * After **working_weekdays** (or other company-wide divisor inputs): recompute **UTC current month** and **UTC prior
 * month** for every user who has ever had a `monthly` wage row. `syncMonthlySalaryPayroll` no-ops users not monthly
 * for that month.
 */
export function scheduleCompanyMonthlySalaryResync(companyId: string): void {
  const months = utcBufferYearMonths();
  void resyncCompanyUsersForMonths(companyId, months).catch((err) =>
    console.error("[salary-resync] company schedule", companyId, err)
  );
}

/** After holiday **create**, **delete**, or **is_paid** change: that holiday’s calendar month plus buffer months. */
export function scheduleCompanyMonthlySalaryResyncForHolidayDate(companyId: string, holidayYmd: IsoDate): void {
  const months = mergeYearMonthLists(utcBufferYearMonths(), [utcYearMonthFromCalendarDate(holidayYmd)]);
  void resyncCompanyUsersForMonths(companyId, months).catch((err) =>
    console.error("[salary-resync] holiday date", companyId, holidayYmd, err)
  );
}

/** After holiday **moved** to another calendar date: old month, new month, plus buffer (covers divisor in both). */
export function scheduleCompanyMonthlySalaryResyncForHolidayMove(
  companyId: string,
  previousYmd: IsoDate,
  newYmd: IsoDate
): void {
  const months = mergeYearMonthLists(utcBufferYearMonths(), [
    utcYearMonthFromCalendarDate(previousYmd),
    utcYearMonthFromCalendarDate(newYmd),
  ]);
  void resyncCompanyUsersForMonths(companyId, months).catch((err) =>
    console.error("[salary-resync] holiday move", companyId, err)
  );
}

/**
 * After wage **create / update / delete**: **UTC buffer months** plus the **effective_from** month (new and/or old).
 * Ensures back-dated rows and switches hourly↔monthly don’t leave stale `salary_daily` behind.
 */
export function scheduleUserMonthlySalaryResync(
  companyId: string,
  userId: string,
  opts?: { newEffectiveYmd?: string; oldEffectiveYmd?: string }
): void {
  const parts: YearMonth[] = [...utcBufferYearMonths()];
  if (opts?.newEffectiveYmd) parts.push(utcYearMonthFromCalendarDate(opts.newEffectiveYmd));
  if (opts?.oldEffectiveYmd) parts.push(utcYearMonthFromCalendarDate(opts.oldEffectiveYmd));
  const months = dedupeYearMonths(parts);
  void resyncOneUserForMonths(userId, companyId, months).catch((err) =>
    console.error("[salary-resync] user wage", userId, err)
  );
}
