/**
 * Shift window resolution (V2 core).
 * Sprint 2: overnight-aware windows; daytime parity when overnight is off.
 */

/** Subset of `shifts` row used for resolution (avoid circular imports). */
export interface ShiftWindowSource {
  id: string;
  start_time: string;
  end_time: string;
  grace_minutes: number | null;
  spans_midnight: boolean;
  is_active: boolean;
}

export interface ResolveShiftWindowInput {
  /** Anchor instant (clock-in, clock-out evaluation, or "now" for absence). */
  anchorIso: string;
  businessTimeZone: string;
  /** Company policy: allows spans_midnight shifts to be meaningful in product. */
  overnightShiftsEnabled: boolean;
  shift: ShiftWindowSource | null;
}

/** @deprecated Use anchorIso — kept for call-site clarity during migration. */
export type ResolveShiftWindowClockInInput = ResolveShiftWindowInput & {
  checkInIso: string;
};

/**
 * Canonical output for attendance ownership, lateness, OT, and absence.
 */
export interface ResolvedShiftWindow {
  startMinutes: number;
  endMinutes: number;
  /** Effective overnight span (DB flag AND policy AND start >= end on clock for HH:mm). */
  spansMidnight: boolean;
  /** When true, use instant-based overnight math; when false, same-day v1 parity paths apply. */
  overnightLogicActive: boolean;
  expectedDurationMinutes: number;
  graceMinutes: number;
  /**
   * Shift-start business calendar date (YYYY-MM-DD) — attendance ownership day.
   * Same-day / policy-off: legacy UTC `check_in` date prefix for parity.
   * Overnight active: shift-start business date (may be previous calendar day for post-midnight check-ins).
   */
  attendanceDateYmd: string;
  /** UTC instant of scheduled shift start for this cycle (overnight active only). */
  shiftStartUtcIso: string | null;
  /** UTC instant of scheduled shift end for this cycle (overnight active only). */
  expectedEndUtcIso: string | null;
  /** UTC instant through which check-in is not late (start + grace). */
  lateAllowedUntilUtcIso: string | null;
}
