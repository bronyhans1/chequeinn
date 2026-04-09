import * as repo from "./shifts.repository";

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
}

function trim(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
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

export async function createShift(
  companyId: string,
  input: {
    name: string;
    start_time: string;
    end_time: string;
    grace_minutes?: number;
  }
): Promise<ServiceResult<repo.ShiftRecord>> {
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

  if (startMinutes >= endMinutes) {
    return { data: null, error: "start_time must be before end_time" };
  }

  if (grace < 0) {
    return { data: null, error: "grace_minutes must be >= 0" };
  }

  const shift = await repo.createShift(companyId, {
    name,
    start_time: start,
    end_time: end,
    grace_minutes: grace,
  });

  return { data: shift };
}

export async function getShifts(
  companyId: string
): Promise<ServiceResult<repo.ShiftRecord[]>> {
  const shifts = await repo.getShifts(companyId);
  return { data: shifts };
}

export async function updateShift(
  shiftId: string,
  companyId: string,
  input: {
    name?: string;
    start_time?: string;
    end_time?: string;
    grace_minutes?: number;
  }
): Promise<ServiceResult<repo.ShiftRecord>> {
  const name = input.name !== undefined ? trim(input.name) : undefined;
  const start = input.start_time !== undefined ? trim(input.start_time) : undefined;
  const end = input.end_time !== undefined ? trim(input.end_time) : undefined;
  const grace =
    typeof input.grace_minutes === "number" ? input.grace_minutes : undefined;

  if (name !== undefined && !name) {
    return { data: null, error: "name cannot be empty" };
  }
  if (start !== undefined || end !== undefined) {
    const startVal = start ?? "";
    const endVal = end ?? "";
    if (!startVal || !endVal) {
      return { data: null, error: "start_time and end_time are both required when updating times" };
    }
    const startMinutes = timeToMinutes(startVal);
    const endMinutes = timeToMinutes(endVal);
    if (startMinutes === null || endMinutes === null) {
      return { data: null, error: "Invalid time format" };
    }
    if (startMinutes >= endMinutes) {
      return { data: null, error: "start_time must be before end_time" };
    }
  }
  if (grace !== undefined && grace < 0) {
    return { data: null, error: "grace_minutes must be >= 0" };
  }

  const payload: repo.UpdateShiftInput = {};
  if (name !== undefined) payload.name = name;
  if (start !== undefined) payload.start_time = start;
  if (end !== undefined) payload.end_time = end;
  if (grace !== undefined) payload.grace_minutes = grace;

  const updated = await repo.updateShift(shiftId, companyId, payload);
  if (!updated) {
    return { data: null, error: "Shift not found" };
  }
  return { data: updated };
}

export async function deleteShift(
  shiftId: string,
  companyId: string
): Promise<ServiceResult<{ success: boolean }>> {
  const existing = await repo.getShiftById(shiftId, companyId);
  if (!existing) {
    return { data: null, error: "Shift not found" };
  }

  const success = await repo.deleteShift(shiftId, companyId);
  return { data: { success } };
}

