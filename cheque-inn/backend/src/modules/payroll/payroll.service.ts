import * as payrollRepo from "./payroll.repository";
import * as wageRatesRepo from "./wageRates.repository";
import * as sessionsRepo from "../sessions/sessions.repository";
import type { WorkSessionRecord } from "../sessions/sessions.repository";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";
import { latePayDeductionFromLateMinutes } from "./salaryEarnings.engine";
import { WorkSessionStatus } from "../../constants/workSessionStatus";

export type SessionPayrollResult =
  | { status: "ok" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

function firstLateCompletedSessionId(rows: WorkSessionRecord[]): string | null {
  const eligible = rows.filter(
    (s) =>
      s.status === WorkSessionStatus.COMPLETED &&
      s.check_in &&
      s.check_out &&
      typeof s.late_minutes === "number" &&
      s.late_minutes > 0
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => new Date(a.check_in!).getTime() - new Date(b.check_in!).getTime());
  return eligible[0]!.id;
}

/**
 * Process payroll for a completed session: compute regular/overtime minutes,
 * fetch hourly rate, calculate gross earnings, and create a payroll record.
 */
export async function processSessionPayroll(
  sessionId: string
): Promise<SessionPayrollResult> {
  try {
    const session = await sessionsRepo.getSessionById(sessionId);
    if (
      !session ||
      session.status !== WorkSessionStatus.COMPLETED ||
      !session.check_in ||
      !session.check_out
    ) {
      return { status: "skipped", reason: "session_not_eligible" };
    }

    const companyId = session.company_id;
    const userId = session.user_id;

    const payrollOn = await companyPolicyService.isPayrollEnabled(companyId);
    if (!payrollOn) return { status: "skipped", reason: "payroll_disabled" };

    const policy = await companyPolicyService.getPolicy(companyId);
    const defaultDailyMinutes = policy.default_daily_hours * 60;

    const sessionMinutes =
      typeof session.duration_minutes === "number" && session.duration_minutes >= 0
        ? session.duration_minutes
        : Math.floor(
            (new Date(session.check_out).getTime() -
              new Date(session.check_in).getTime()) /
              60000
          );

    const regularMinutes = Math.min(sessionMinutes, defaultDailyMinutes);
    const overtimeMinutes = Math.max(0, sessionMinutes - regularMinutes);
    const hoursWorked = sessionMinutes / 60;

    const sessionDate = session.check_in.slice(0, 10);
    const hourlyRate = await wageRatesRepo.getHourlyRate(
      userId,
      companyId,
      sessionDate
    );
    if (hourlyRate === null || hourlyRate < 0) {
      return { status: "skipped", reason: "no_hourly_rate" };
    }

    const regularPay = (regularMinutes / 60) * hourlyRate;
    const overtimePay =
      (overtimeMinutes / 60) * hourlyRate * policy.overtime_multiplier;
    let grossEarnings = regularPay + overtimePay;
    let grossBeforeLate: number | null = null;
    let lateDedAmount: number | null = null;

    if (policy.late_pay_deduction_enabled === true) {
      const lateM =
        typeof session.late_minutes === "number" && session.late_minutes > 0
          ? session.late_minutes
          : 0;
      if (lateM > 0 && hourlyRate > 0) {
        const dayStart = `${sessionDate}T00:00:00.000Z`;
        const dayEnd = (() => {
          const [yy, mm, dd] = sessionDate.split("-").map(Number);
          return new Date(Date.UTC(yy, mm - 1, dd + 1)).toISOString();
        })();
        const { rows: sameCalendarDay } = await sessionsRepo.listSessionsForUser(
          userId,
          companyId,
          { startIso: dayStart, endIso: dayEnd, limit: 200, offset: 0 }
        );
        const ownerId = firstLateCompletedSessionId(sameCalendarDay);
        if (ownerId === sessionId) {
          grossBeforeLate = Math.round(grossEarnings * 100) / 100;
          const ded = latePayDeductionFromLateMinutes(lateM, hourlyRate);
          lateDedAmount = ded;
          grossEarnings = Math.max(
            0,
            Math.round((grossEarnings - ded) * 100) / 100
          );
        }
      }
    }

    const payrollDate = sessionDate;

    await payrollRepo.createPayrollRecord({
      user_id: userId,
      company_id: companyId,
      session_id: sessionId,
      regular_minutes: regularMinutes,
      overtime_minutes: overtimeMinutes,
      hours_worked: Math.round(hoursWorked * 100) / 100,
      hourly_rate: hourlyRate,
      gross_earnings: Math.round(grossEarnings * 100) / 100,
      payroll_date: payrollDate,
      gross_before_late_deduction: grossBeforeLate,
      late_deduction_amount: lateDedAmount,
    });
    return { status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("processSessionPayroll error", err);
    return { status: "failed", error: msg };
  }
}
