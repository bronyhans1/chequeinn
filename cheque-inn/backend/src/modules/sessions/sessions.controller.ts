import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import * as sessionsService from "./sessions.service";
import * as usersRepo from "../users/users.repository";
import { resolveManagerListUserIds } from "../../lib/resolveScopedUserIds";
import { assertManualClockTargetAllowed } from "../../lib/manualClockScope";
import { parseManualAttendanceFields } from "../../lib/manualAttendancePayload";
import { isClockOutGeofenceError } from "../../constants/employeeAttendanceMessages";
import { logAction } from "../audit/audit.service";

function trimString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

async function buildManualAttendanceAuditMetadata(
  companyId: string,
  targetUserId: string,
  parsed: { reason: string; note: string | null },
  actorUserId: string,
  departmentId?: string | null
): Promise<Record<string, unknown>> {
  const target = await usersRepo.findByIdAndCompanyId(targetUserId, companyId);
  const targetName = target
    ? [target.first_name?.trim(), target.last_name?.trim()].filter(Boolean).join(" ").trim()
    : "";

  const meta: Record<string, unknown> = {
    target_user_id: targetUserId,
    manual_reason: parsed.reason,
    actor_user_id: actorUserId,
  };
  if (targetName) meta.target_user_name = targetName;
  if (target?.email) meta.target_user_email = target.email;
  if (departmentId) meta.department_id = departmentId;
  if (parsed.note?.trim()) meta.manual_note = parsed.note.trim();
  return meta;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

export async function clockIn(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const department_id = trimString(req.body?.department_id);
    const branch_id = trimString(req.body?.branch_id);
    const latitude = parseNumber(req.body?.latitude);
    const longitude = parseNumber(req.body?.longitude);

    const result = await sessionsService.clockIn(userId, companyId, {
      department_id,
      branch_id,
      latitude,
      longitude,
    });

    if (result.error) {
      if (result.error === "You already have an active clock-in session") {
        res
          .status(409)
          .json({ success: false, error: result.error });
        return;
      }

      res
        .status(400)
        .json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
    await logAction(companyId, userId, "session.clock_in", "work_session", result.data!.id, {
      branch_id: result.data?.branch_id ?? null,
      department_id: result.data?.department_id ?? null,
      source: "self",
    });
  } catch (err) {
    console.error("clockIn error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function clockOut(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const latitude = parseNumber(req.body?.latitude);
    const longitude = parseNumber(req.body?.longitude);

    if (latitude === undefined || longitude === undefined) {
      res
        .status(400)
        .json({ success: false, error: "Location permission is required" });
      return;
    }

    const result = await sessionsService.clockOut(
      userId,
      companyId,
      latitude,
      longitude
    );

    if (result.error) {
      if (result.error === "No active session found") {
        res
          .status(404)
          .json({ success: false, error: result.error });
        return;
      }

      if (isClockOutGeofenceError(result.error)) {
        res
          .status(403)
          .json({ success: false, error: result.error });
        return;
      }

      res
        .status(400)
        .json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      warnings: result.warnings ?? [],
    });
    await logAction(companyId, userId, "session.clock_out", "work_session", result.data!.id, {
      source: "self",
      payroll_warnings: (result.warnings ?? []).map((w) => w.code),
    });
  } catch (err) {
    console.error("clockOut error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function manualClockIn(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const targetUserId = trimString(req.body?.user_id);
    const department_id = trimString(req.body?.department_id);
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!targetUserId) {
      res
        .status(400)
        .json({ success: false, error: "user_id is required" });
      return;
    }

    const parsed = parseManualAttendanceFields(body);
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error });
      return;
    }

    const gate = await assertManualClockTargetAllowed(req, companyId, targetUserId);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const result = await sessionsService.manualClockIn(
      targetUserId,
      companyId,
      { department_id },
      {
        reason: parsed.reason,
        note: parsed.note,
        actorUserId: userId,
      }
    );

    if (result.error) {
      if (result.error === "You already have an active clock-in session") {
        res
          .status(409)
          .json({ success: false, error: result.error });
        return;
      }

      res
        .status(400)
        .json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
    const auditMeta = await buildManualAttendanceAuditMetadata(
      companyId,
      targetUserId,
      parsed,
      userId,
      department_id ?? null
    );
    await logAction(companyId, userId, "session.manual_clock_in", "work_session", result.data!.id, auditMeta);
  } catch (err) {
    console.error("manualClockIn error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function manualClockOut(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const targetUserId = trimString(req.body?.user_id);
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!targetUserId) {
      res
        .status(400)
        .json({ success: false, error: "user_id is required" });
      return;
    }

    const parsed = parseManualAttendanceFields(body);
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error });
      return;
    }

    const gate = await assertManualClockTargetAllowed(req, companyId, targetUserId);
    if (!gate.ok) {
      res.status(gate.status).json({ success: false, error: gate.message });
      return;
    }

    const result = await sessionsService.manualClockOut(targetUserId, companyId, {
      reason: parsed.reason,
      note: parsed.note,
      actorUserId: userId,
    });

    if (result.error) {
      const status = result.error === "No active session" ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      warnings: result.warnings ?? [],
    });
    const auditMeta = await buildManualAttendanceAuditMetadata(
      companyId,
      targetUserId,
      parsed,
      req.context!.userId,
      null
    );
    await logAction(companyId, req.context!.userId, "session.manual_clock_out", "work_session", result.data!.id, {
      ...auditMeta,
      payroll_warnings: (result.warnings ?? []).map((w) => w.code),
    });
  } catch (err) {
    console.error("manualClockOut error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getTodaySessionsForUser(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);

    const sessions =
      await sessionsService.getTodaySessionsForUser(
        userId,
        companyId
      );

    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error("getTodaySessionsForUser error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getTodaySessionsForCompany(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;

    const resolved = await resolveManagerListUserIds(ctx, companyId);
    if (resolved.error) {
      res
        .status(resolved.error.status)
        .json({ success: false, error: resolved.error.message });
      return;
    }

    const sessions =
      await sessionsService.getTodaySessionsForCompany(
        companyId,
        resolved.scopedUserIds
      );

    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error("getTodaySessionsForCompany error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

function parsePageLimit(req: ContextRequest): { page: number; limit: number } {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 && limit <= 100 ? limit : 20;
  return { page: safePage, limit: safeLimit };
}

/** Optional ISO date (YYYY-MM-DD) → start of that day UTC */
function parseStartIso(q: unknown): string | undefined {
  if (typeof q !== "string" || !q.trim()) return undefined;
  const d = new Date(q.trim() + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Optional ISO date (YYYY-MM-DD) → start of *next* day UTC (exclusive upper bound for check_in) */
function parseEndIsoExclusive(q: unknown): string | undefined {
  if (typeof q !== "string" || !q.trim()) return undefined;
  const d = new Date(q.trim() + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Last 90 days UTC when no query range is provided (avoids unbounded scans). */
function defaultHistoryRange(): { startIso: string; endIso: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function getMySessionHistory(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const { page, limit } = parsePageLimit(req);
    let startIso = parseStartIso(req.query.start);
    let endIso = parseEndIsoExclusive(req.query.end);
    if (!startIso && !endIso) {
      const d = defaultHistoryRange();
      startIso = d.startIso;
      endIso = d.endIso;
    }

    const data = await sessionsService.getMySessionHistory(
      userId,
      companyId,
      page,
      limit,
      startIso,
      endIso
    );

    res.json({ success: true, data });
  } catch (err) {
    console.error("getMySessionHistory error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getCompanySessionHistory(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const ctx = getRequiredCompanyContext(req);
    const { companyId } = ctx;
    const { page, limit } = parsePageLimit(req);
    let startIso = parseStartIso(req.query.start);
    let endIso = parseEndIsoExclusive(req.query.end);
    if (!startIso && !endIso) {
      const d = defaultHistoryRange();
      startIso = d.startIso;
      endIso = d.endIso;
    }
    const filterUserId =
      typeof req.query.user_id === "string" && req.query.user_id.trim()
        ? req.query.user_id.trim()
        : undefined;

    const resolved = await resolveManagerListUserIds(ctx, companyId);
    if (resolved.error) {
      res
        .status(resolved.error.status)
        .json({ success: false, error: resolved.error.message });
      return;
    }
    const scopedUserIds = resolved.scopedUserIds;

    if (filterUserId) {
      const u = await usersRepo.findByIdAndCompanyId(filterUserId, companyId);
      if (!u) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }
      if (
        scopedUserIds !== undefined &&
        scopedUserIds !== null &&
        !scopedUserIds.includes(filterUserId)
      ) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }
    }

    const data = await sessionsService.getCompanySessionHistory(
      companyId,
      page,
      limit,
      { userId: filterUserId, startIso, endIso, scopedUserIds }
    );

    res.json({ success: true, data });
  } catch (err) {
    console.error("getCompanySessionHistory error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

