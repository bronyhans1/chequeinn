import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as repo from "./attendanceDayOverrides.repository";
import * as sessionsRepo from "../sessions/sessions.repository";
import { WorkSessionStatus } from "../../constants/workSessionStatus";
import { normalizeAttendanceThresholds, classifyAttendanceDayByWorkedMinutes } from "../payroll/salaryEarnings.engine";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";
import { logAction } from "../audit/audit.service";

function trim(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function isValidYmd(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function parseDayUnits(v: unknown): 0 | 0.5 | 1 | null {
  if (v === 0 || v === 0.5 || v === 1) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (n === 0 || n === 0.5 || n === 1) return n as 0 | 0.5 | 1;
  }
  return null;
}

export async function getDayClassification(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const userId = trim(req.query.user_id);
    const date = trim(req.query.date);
    if (!userId) {
      res.status(400).json({ success: false, error: "user_id is required" });
      return;
    }
    if (!date || !isValidYmd(date)) {
      res.status(400).json({ success: false, error: "date must be YYYY-MM-DD" });
      return;
    }

    // Sessions are owned by check_in date; include completed sessions that checked in on this date.
    const startIso = `${date}T00:00:00.000Z`;
    const endIso = `${date}T23:59:59.999Z`;
    const { rows: sessions } = await sessionsRepo.listSessionsForUser(userId, companyId, {
      startIso,
      endIso,
      limit: 2000,
      offset: 0,
    });

    let hasOpen = false;
    let workedMinutes = 0;
    for (const s of sessions) {
      if (s.status === WorkSessionStatus.ACTIVE && !s.check_out) hasOpen = true;
      if (s.status !== WorkSessionStatus.COMPLETED) continue;
      const mins =
        typeof (s as any).duration_minutes === "number" && (s as any).duration_minutes >= 0
          ? (s as any).duration_minutes
          : s.check_in && s.check_out
            ? Math.floor((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000)
            : 0;
      workedMinutes += Math.max(0, mins);
    }

    const pol = await companyPolicyService.getPolicy(companyId);
    const thresholds = normalizeAttendanceThresholds({
      minimum_minutes_for_counted_day: (pol as any).minimum_minutes_for_counted_day,
      full_day_minutes_threshold: (pol as any).full_day_minutes_threshold,
      default_daily_hours: (pol as any).default_daily_hours,
    });

    const enabled = (pol as any).attendance_day_classification_enabled === true;
    const auto = enabled
      ? classifyAttendanceDayByWorkedMinutes(workedMinutes, thresholds).day_units
      : workedMinutes > 0
        ? 1
        : 0;

    const overrides = await repo.listForUserRange(companyId, userId, date, date);
    const override = overrides[0] ?? null;
    const finalUnits = override ? (override.day_units as number) : auto;

    res.json({
      success: true,
      data: {
        user_id: userId,
        date,
        has_incomplete_session: hasOpen,
        worked_minutes_completed: workedMinutes,
        classification_enabled: enabled,
        thresholds,
        automatic_day_units: auto,
        override_day_units: override ? override.day_units : null,
        final_day_units: finalUnits,
        override_note: override?.note ?? null,
      },
    });
  } catch (err) {
    console.error("getDayClassification error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function upsertDayOverride(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId: actorId } = getRequiredCompanyContext(req);
    const userId = trim(req.body?.user_id) ?? "";
    const date = trim(req.body?.date) ?? "";
    const units = parseDayUnits(req.body?.day_units);
    const note = req.body?.note !== undefined ? trim(req.body?.note) ?? null : null;

    if (!userId) {
      res.status(400).json({ success: false, error: "user_id is required" });
      return;
    }
    if (!date || !isValidYmd(date)) {
      res.status(400).json({ success: false, error: "date must be YYYY-MM-DD" });
      return;
    }
    if (units === null) {
      res.status(400).json({ success: false, error: "day_units must be 0, 0.5, or 1" });
      return;
    }

    const row = await repo.upsertOverride({
      company_id: companyId,
      user_id: userId,
      attendance_date: date,
      day_units: units,
      note,
      created_by: actorId,
    });

    try {
      await logAction(companyId, actorId, "attendance_day_override_upserted", "attendance_day_override", row.id, {
        user_id: userId,
        date,
        day_units: units,
      });
    } catch (e) {
      console.error("audit override upsert", e);
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error("upsertDayOverride error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteDayOverride(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId: actorId } = getRequiredCompanyContext(req);
    const userId = trim(req.query.user_id) ?? "";
    const date = trim(req.query.date) ?? "";
    if (!userId) {
      res.status(400).json({ success: false, error: "user_id is required" });
      return;
    }
    if (!date || !isValidYmd(date)) {
      res.status(400).json({ success: false, error: "date must be YYYY-MM-DD" });
      return;
    }
    const ok = await repo.deleteOverride(companyId, userId, date);
    if (ok) {
      try {
        await logAction(companyId, actorId, "attendance_day_override_deleted", "attendance_day_override", `${userId}:${date}`, {
          user_id: userId,
          date,
        });
      } catch (e) {
        console.error("audit override delete", e);
      }
    }
    res.json({ success: true, data: { deleted: ok } });
  } catch (err) {
    console.error("deleteDayOverride error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

