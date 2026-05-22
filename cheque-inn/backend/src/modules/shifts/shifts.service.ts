import * as repo from "./shifts.repository";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";

export interface ShiftServiceResult<T> {
  data: T | null;
  error?: string;
  httpStatus?: number;
}

function trim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}

function timeToMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }
  return h * 60 + m;
}

const TIMING_LOCKED_MSG =
  "This shift has historical attendance sessions. You cannot change start time, end time, or overnight mode. Create a new shift, reassign employees, then deactivate this one.";

/** Treat missing/undefined is_active as active (pre-migration rows). */
export function shiftRowActive(row: repo.ShiftRecord): boolean {
  return row.is_active !== false;
}

export async function createShift(
  companyId: string,
  input: {
    name: string;
    start_time: string;
    end_time: string;
    grace_minutes?: number;
  }
): Promise<ShiftServiceResult<repo.ShiftRecord>> {
  const name = trim(input.name);
  const start = trim(input.start_time);
  const end = trim(input.end_time);
  const grace =
    typeof input.grace_minutes === "number" ? input.grace_minutes : 0;

  if (!name) {
    return { data: null, error: "name is required" };
  }
  if (!start || !end) {
    return { data: null, error: "start_time and end_time are required" };
  }

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes === null || endMinutes === null) {
    return { data: null, error: "Invalid time format" };
  }
  if (startMinutes === endMinutes) {
    return { data: null, error: "start_time and end_time must differ" };
  }

  const policy = await companyPolicyService.getPolicy(companyId);
  const overnightOn = policy.overnight_shifts_enabled === true;

  let spansMidnight = false;
  if (overnightOn && endMinutes <= startMinutes) {
    spansMidnight = true;
  } else if (!overnightOn && startMinutes >= endMinutes) {
    return {
      data: null,
      error:
        "start_time must be before end_time on the same calendar day. Enable overnight shifts in company policy to use cross-midnight schedules.",
    };
  }

  if (grace < 0) {
    return { data: null, error: "grace_minutes must be >= 0" };
  }

  const shift = await repo.createShift(companyId, {
    name,
    start_time: start,
    end_time: end,
    grace_minutes: grace,
    spans_midnight: spansMidnight,
    is_active: true,
  });

  return { data: shift };
}

export async function getShifts(
  companyId: string
): Promise<ShiftServiceResult<repo.ShiftRecord[]>> {
  const shifts = await repo.getShifts(companyId);
  return { data: shifts };
}

function timingFieldsChanged(params: {
  prev: repo.ShiftRecord;
  nextStart?: string;
  nextEnd?: string;
  nextSpans?: boolean;
}): boolean {
  const { prev, nextStart, nextEnd, nextSpans } = params;
  if (nextSpans !== undefined && nextSpans !== !!prev.spans_midnight) return true;
  if (nextStart !== undefined && nextStart !== prev.start_time) return true;
  if (nextEnd !== undefined && nextEnd !== prev.end_time) return true;
  return false;
}

export async function updateShift(
  shiftId: string,
  companyId: string,
  input: {
    name?: string;
    start_time?: string;
    end_time?: string;
    grace_minutes?: number;
    spans_midnight?: boolean;
    is_active?: boolean;
  }
): Promise<ShiftServiceResult<repo.ShiftRecord>> {
  const name = input.name !== undefined ? trim(input.name) : undefined;
  const start = input.start_time !== undefined ? trim(input.start_time) : undefined;
  const end = input.end_time !== undefined ? trim(input.end_time) : undefined;
  const grace =
    typeof input.grace_minutes === "number" ? input.grace_minutes : undefined;
  const spansMidnightIn = input.spans_midnight;
  const isActiveIn = input.is_active;

  if (name !== undefined && !name) {
    return { data: null, error: "name cannot be empty" };
  }

  const existing = await repo.getShiftById(shiftId, companyId);
  if (!existing) {
    return { data: null, error: "Shift not found", httpStatus: 404 };
  }

  const sessionCount = await repo.countSessionsForShift(shiftId, companyId);
  if (
    sessionCount > 0 &&
    timingFieldsChanged({
      prev: existing,
      nextStart: start,
      nextEnd: end,
      nextSpans: spansMidnightIn,
    })
  ) {
    return { data: null, error: TIMING_LOCKED_MSG, httpStatus: 409 };
  }

  const payload: repo.UpdateShiftInput = {};
  if (name !== undefined) payload.name = name;
  if (grace !== undefined) {
    if (grace < 0) {
      return { data: null, error: "grace_minutes must be >= 0" };
    }
    payload.grace_minutes = grace;
  }
  if (isActiveIn !== undefined) payload.is_active = isActiveIn;

  const timesTouched = start !== undefined || end !== undefined;
  if (timesTouched) {
    const startVal = start ?? existing.start_time;
    const endVal = end ?? existing.end_time;
    if (!startVal || !endVal) {
      return {
        data: null,
        error: "start_time and end_time are both required when updating times",
      };
    }
    const startMinutes = timeToMinutes(startVal);
    const endMinutes = timeToMinutes(endVal);
    if (startMinutes === null || endMinutes === null) {
      return { data: null, error: "Invalid time format" };
    }
    if (startMinutes === endMinutes) {
      return { data: null, error: "start_time and end_time must differ" };
    }

    const policy = await companyPolicyService.getPolicy(companyId);
    const overnightOn = policy.overnight_shifts_enabled === true;

    let effectiveSpans = existing.spans_midnight === true;
    if (spansMidnightIn !== undefined) {
      effectiveSpans = spansMidnightIn;
    }

    if (overnightOn && endMinutes <= startMinutes) {
      effectiveSpans = true;
    } else if (!overnightOn && startMinutes >= endMinutes) {
      return {
        data: null,
        error:
          "start_time must be before end_time on the same calendar day, or enable overnight shifts in policy.",
      };
    } else {
      effectiveSpans = false;
    }

    payload.start_time = startVal;
    payload.end_time = endVal;
    payload.spans_midnight = effectiveSpans;
  } else if (spansMidnightIn !== undefined) {
    payload.spans_midnight = spansMidnightIn;
  }

  if (Object.keys(payload).length === 0) {
    return { data: existing };
  }

  const updated = await repo.updateShift(shiftId, companyId, payload);
  if (!updated) {
    return { data: null, error: "Shift not found", httpStatus: 404 };
  }
  return { data: updated };
}

export async function deleteShift(
  shiftId: string,
  companyId: string
): Promise<
  ShiftServiceResult<{ success: boolean; deactivated?: boolean; deleted?: boolean }>
> {
  const existing = await repo.getShiftById(shiftId, companyId);
  if (!existing) {
    return { data: null, error: "Shift not found", httpStatus: 404 };
  }

  const sessionCount = await repo.countSessionsForShift(shiftId, companyId);
  if (sessionCount > 0) {
    await repo.updateShift(shiftId, companyId, { is_active: false });
    return { data: { success: true, deactivated: true } };
  }

  const deleted = await repo.deleteShift(shiftId, companyId);
  return { data: { success: deleted, deleted } };
}
