import type { ManualAttendanceReasonCode } from "../constants/manualAttendance";
import { isValidManualReasonCode } from "../constants/manualAttendance";

export type ManualAttendanceFields =
  | { ok: true; reason: ManualAttendanceReasonCode; note: string | null }
  | { ok: false; error: string };

/** Parses and validates `reason` + `note` from JSON body for manual clock-in/out. */
export function parseManualAttendanceFields(body: Record<string, unknown>): ManualAttendanceFields {
  const reasonRaw = body.reason;
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (!reason || !isValidManualReasonCode(reason)) {
    return {
      ok: false,
      error: "reason must be one of the allowed manual attendance reasons",
    };
  }

  const noteRaw = body.note;
  let note: string | null = null;
  if (noteRaw === undefined || noteRaw === null || noteRaw === "") {
    note = null;
  } else if (typeof noteRaw === "string") {
    const t = noteRaw.trim();
    note = t ? t : null;
  } else {
    return { ok: false, error: "note must be a string when provided" };
  }

  if (reason === "other" && !note) {
    return { ok: false, error: 'note is required when reason is "other"' };
  }

  return { ok: true, reason, note };
}
