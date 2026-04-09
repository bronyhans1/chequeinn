import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import type { CompanyPolicyRecord } from "./companyPolicy.repository";
import * as companyPolicyService from "./companyPolicy.service";
import * as auditService from "../audit/audit.service";
import * as salaryResync from "../payroll/salaryEarnings.resync";
import * as payrollRepo from "../payroll/payroll.repository";
import * as wageRatesRepo from "../wageRates/wageRates.repository";
import {
  messageIfCannotDisablePayroll,
  payrollDisableBlockedByArtifacts,
} from "./payrollDisableGuard";

function canEditWorkingSchedule(req: ContextRequest): boolean {
  const roles = req.context!.roles ?? [];
  return roles.includes("admin") || roles.includes("HR");
}

function isAdmin(req: ContextRequest): boolean {
  const roles = req.context!.roles ?? [];
  return roles.includes("admin");
}

async function attachPayrollDisableFlag(
  companyId: string,
  policy: CompanyPolicyRecord
): Promise<CompanyPolicyRecord & { payroll_disable_blocked: boolean }> {
  const [hasPayrollRecords, hasWageRateRows] = await Promise.all([
    payrollRepo.companyHasAnyPayrollRecords(companyId),
    wageRatesRepo.companyHasAnyWageRates(companyId),
  ]);
  return {
    ...policy,
    payroll_disable_blocked: payrollDisableBlockedByArtifacts(
      hasPayrollRecords,
      hasWageRateRows
    ),
  };
}

export async function getPolicy(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const policy = await companyPolicyService.getPolicy(companyId);
    const data = await attachPayrollDisableFlag(companyId, policy);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getPolicy error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function updatePolicy(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const body = req.body ?? {};
    const default_daily_hours =
      typeof body.default_daily_hours === "number"
        ? body.default_daily_hours
        : undefined;
    const overtime_multiplier =
      typeof body.overtime_multiplier === "number"
        ? body.overtime_multiplier
        : undefined;
    let lateness_tracking_enabled: unknown = undefined;
    if (body.lateness_tracking_enabled !== undefined) {
      if (typeof body.lateness_tracking_enabled !== "boolean") {
        res.status(400).json({
          success: false,
          error: "lateness_tracking_enabled must be a boolean",
        });
        return;
      }
      lateness_tracking_enabled = body.lateness_tracking_enabled;
    }

    let late_pay_deduction_enabled: unknown = undefined;
    if (body.late_pay_deduction_enabled !== undefined) {
      if (typeof body.late_pay_deduction_enabled !== "boolean") {
        res.status(400).json({
          success: false,
          error: "late_pay_deduction_enabled must be a boolean",
        });
        return;
      }
      late_pay_deduction_enabled = body.late_pay_deduction_enabled;
    }

    let working_weekdays: unknown = undefined;
    let workingWeekdaysUpdated = false;
    if (body.working_weekdays !== undefined) {
      if (!canEditWorkingSchedule(req)) {
        res.status(403).json({
          success: false,
          error:
            "Only company admin or HR can change the working-week schedule used for monthly salary.",
        });
        return;
      }
      working_weekdays = body.working_weekdays;
      workingWeekdaysUpdated = true;
    }

    let payroll_enabled: unknown = undefined;
    if (body.payroll_enabled !== undefined) {
      if (!isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: "Only company admin can enable or disable payroll.",
        });
        return;
      }
      if (typeof body.payroll_enabled !== "boolean") {
        res.status(400).json({
          success: false,
          error: "payroll_enabled must be a boolean",
        });
        return;
      }
      payroll_enabled = body.payroll_enabled;
    }

    if (payroll_enabled === false) {
      const currentPolicy = await companyPolicyService.getPolicy(companyId);
      const currentPayrollOn = currentPolicy.payroll_enabled !== false;
      const [hasPayrollRecords, hasWageRateRows] = await Promise.all([
        payrollRepo.companyHasAnyPayrollRecords(companyId),
        wageRatesRepo.companyHasAnyWageRates(companyId),
      ]);
      const blockMsg = messageIfCannotDisablePayroll({
        requestedPayrollEnabled: false,
        currentPayrollEnabled: currentPayrollOn,
        hasPayrollRecords,
        hasWageRateRows,
      });
      if (blockMsg) {
        res.status(400).json({ success: false, error: blockMsg });
        return;
      }
    }

    let business_timezone: unknown = undefined;
    if (body.business_timezone !== undefined) {
      if (!isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: "Only company admin can change the business time zone.",
        });
        return;
      }
      if (typeof body.business_timezone !== "string" || !body.business_timezone.trim()) {
        res.status(400).json({
          success: false,
          error: "business_timezone must be a non-empty string (IANA name, e.g. Africa/Accra)",
        });
        return;
      }
      business_timezone = body.business_timezone.trim();
    }

    let attendance_day_classification_enabled: unknown = undefined;
    if (body.attendance_day_classification_enabled !== undefined) {
      if (!isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: "Only company admin can enable or disable attendance day classification.",
        });
        return;
      }
      if (typeof body.attendance_day_classification_enabled !== "boolean") {
        res.status(400).json({
          success: false,
          error: "attendance_day_classification_enabled must be a boolean",
        });
        return;
      }
      attendance_day_classification_enabled = body.attendance_day_classification_enabled;
    }

    const minM = body.minimum_minutes_for_counted_day;
    const fullM = body.full_day_minutes_threshold;
    for (const [key, v] of [
      ["minimum_minutes_for_counted_day", minM],
      ["full_day_minutes_threshold", fullM],
    ] as const) {
      if (v === undefined) continue;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1440) {
        res.status(400).json({ success: false, error: `${key} must be an integer 0-1440` });
        return;
      }
    }
    if (
      typeof minM === "number" &&
      typeof fullM === "number" &&
      fullM < minM
    ) {
      res.status(400).json({
        success: false,
        error: "full_day_minutes_threshold must be greater than or equal to minimum_minutes_for_counted_day",
      });
      return;
    }

    let currency_code: unknown = undefined;
    if (body.currency_code !== undefined) {
      if (!isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: "Only company admin can change currency.",
        });
        return;
      }
      const hasPayroll = await payrollRepo.companyHasAnyPayrollRecords(companyId);
      if (hasPayroll) {
        res.status(400).json({
          success: false,
          error: "Currency cannot be changed after payroll data exists",
        });
        return;
      }
      currency_code = body.currency_code;
    }

    const result = await companyPolicyService.updatePolicy(companyId, {
      default_daily_hours,
      overtime_multiplier,
      lateness_tracking_enabled: lateness_tracking_enabled as boolean | undefined,
      late_pay_deduction_enabled: late_pay_deduction_enabled as boolean | undefined,
      payroll_enabled: payroll_enabled as boolean | undefined,
      business_timezone: business_timezone as string | undefined,
      attendance_day_classification_enabled: attendance_day_classification_enabled as boolean | undefined,
      minimum_minutes_for_counted_day:
        typeof minM === "number" ? minM : undefined,
      full_day_minutes_threshold:
        typeof fullM === "number" ? fullM : undefined,
      currency_code: currency_code as string | undefined,
      working_weekdays,
    });

    if (result.error) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    if (!result.data) {
      res.status(400).json({ success: false, error: "Failed to update policy" });
      return;
    }
    try {
      await auditService.logAction(
        companyId,
        userId,
        "company_policy_updated",
        "company_policy",
        result.data.id,
        {
          default_daily_hours: result.data.default_daily_hours,
          overtime_multiplier: result.data.overtime_multiplier,
          lateness_tracking_enabled: result.data.lateness_tracking_enabled,
          late_pay_deduction_enabled: result.data.late_pay_deduction_enabled,
          currency_code: (result.data as { currency_code?: unknown }).currency_code,
          payroll_enabled: (result.data as { payroll_enabled?: unknown }).payroll_enabled,
          business_timezone: (result.data as { business_timezone?: unknown }).business_timezone,
          attendance_day_classification_enabled: (result.data as { attendance_day_classification_enabled?: unknown })
            .attendance_day_classification_enabled,
          minimum_minutes_for_counted_day: (result.data as { minimum_minutes_for_counted_day?: unknown })
            .minimum_minutes_for_counted_day,
          full_day_minutes_threshold: (result.data as { full_day_minutes_threshold?: unknown })
            .full_day_minutes_threshold,
          working_weekdays: (result.data as { working_weekdays?: unknown }).working_weekdays,
        }
      );
    } catch (auditErr) {
      console.error("Audit log company_policy_updated error", auditErr);
    }
    const latenessPaySettingsUpdated =
      lateness_tracking_enabled !== undefined || late_pay_deduction_enabled !== undefined;
    if ((workingWeekdaysUpdated || latenessPaySettingsUpdated) && companyId) {
      salaryResync.scheduleCompanyMonthlySalaryResync(companyId);
    }
    // Currency change does not trigger resync; values are stored as-is.
    const data = await attachPayrollDisableFlag(companyId, result.data);
    res.json({ success: true, data });
  } catch (err) {
    console.error("updatePolicy error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
