import {
  attendanceDateYmdFromCheckInUtcSlice,
  computeLateMinutesFromWindow,
  computeOvertimeMinutesFromWindow,
  resolveShiftWindow,
  resolveShiftWindowAtCheckIn,
  shouldMarkAbsentNow,
} from "../index";
import type { ShiftWindowSource } from "../types";

const TZ = "Africa/Accra";

function baseShift(partial: Partial<ShiftWindowSource> = {}): ShiftWindowSource {
  return {
    id: "shift-1",
    start_time: "09:00",
    end_time: "17:00",
    grace_minutes: 0,
    spans_midnight: false,
    is_active: true,
    ...partial,
  };
}

const overnightShift = baseShift({
  start_time: "22:00",
  end_time: "06:00",
  spans_midnight: true,
});

describe("resolveShiftWindow Sprint 2", () => {
  describe("daytime parity (overnight policy off)", () => {
    it("attendance_date uses UTC check-in prefix", () => {
      const checkInIso = "2026-05-20T07:15:00.000Z";
      const r = resolveShiftWindowAtCheckIn({
        checkInIso,
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: baseShift(),
      });
      expect(r.attendanceDateYmd).toBe("2026-05-20");
      expect(r.overnightLogicActive).toBe(false);
    });

    it("same-day lateness unchanged via window metrics", () => {
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-05-20T16:20:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: baseShift({ start_time: "16:00", end_time: "23:00", grace_minutes: 15 }),
      });
      expect(window.overnightLogicActive).toBe(false);
      expect(
        computeLateMinutesFromWindow(window, "2026-05-20T16:20:00.000Z", TZ)
      ).toBe(5);
    });

    it("same-day OT unchanged via window metrics", () => {
      const checkIn = "2026-05-20T15:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: baseShift({ start_time: "16:00", end_time: "23:00" }),
      });
      expect(
        computeOvertimeMinutesFromWindow(window, "2026-05-20T23:30:00.000Z", TZ)
      ).toBe(30);
    });

    it("evening shift 16:00–23:00: no overnight span", () => {
      const r = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-05-20T15:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: baseShift({ start_time: "16:00", end_time: "23:00" }),
      });
      expect(r.spansMidnight).toBe(false);
      expect(r.expectedDurationMinutes).toBe(7 * 60);
    });
  });

  describe("overnight attendance ownership (policy on)", () => {
    it("22:00 Mon check-in → Monday attendance_date", () => {
      const r = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-05-18T22:05:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(r.overnightLogicActive).toBe(true);
      expect(r.attendanceDateYmd).toBe("2026-05-18");
    });

    it("01:00 Tue check-in → Monday attendance_date (shift-start business date)", () => {
      const r = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-05-19T01:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(r.attendanceDateYmd).toBe("2026-05-18");
    });

    it("month boundary: Fri 23:00 → Fri; Sat 02:00 → Fri", () => {
      const fri = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-01-30T23:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(fri.attendanceDateYmd).toBe("2026-01-30");

      const satEarly = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-01-31T02:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(satEarly.attendanceDateYmd).toBe("2026-01-30");
    });
  });

  describe("overnight lateness", () => {
    it("01:00 Tue check-in is ~3h late for 22:00 Mon start", () => {
      const checkIn = "2026-05-19T01:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(computeLateMinutesFromWindow(window, checkIn, TZ)).toBe(3 * 60);
    });

    it("on-time at 22:00 Mon", () => {
      const checkIn = "2026-05-18T22:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(computeLateMinutesFromWindow(window, checkIn, TZ)).toBe(0);
    });

    it("10 min late at 22:10 Mon (0 grace)", () => {
      const checkIn = "2026-05-18T22:10:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(computeLateMinutesFromWindow(window, checkIn, TZ)).toBe(10);
    });

    it("policy off: 01:00 Tue uses same-day path (legacy zero late bug preserved)", () => {
      const checkIn = "2026-05-19T01:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: overnightShift,
      });
      expect(window.overnightLogicActive).toBe(false);
      expect(computeLateMinutesFromWindow(window, checkIn, TZ)).toBe(0);
    });
  });

  describe("overnight overtime", () => {
    it("07:00 Tue checkout → 60m OT for 22:00–06:00 shift", () => {
      const checkIn = "2026-05-18T22:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(
        computeOvertimeMinutesFromWindow(window, "2026-05-19T07:00:00.000Z", TZ)
      ).toBe(60);
    });

    it("06:00 checkout → 0 OT", () => {
      const checkIn = "2026-05-18T22:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(
        computeOvertimeMinutesFromWindow(window, "2026-05-19T06:00:00.000Z", TZ)
      ).toBe(0);
    });

    it("23:00 checkout does not produce false 17h OT", () => {
      const checkIn = "2026-05-18T22:00:00.000Z";
      const window = resolveShiftWindowAtCheckIn({
        checkInIso: checkIn,
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(
        computeOvertimeMinutesFromWindow(window, "2026-05-18T23:00:00.000Z", TZ)
      ).toBe(0);
    });
  });

  describe("overnight absent (shouldMarkAbsentNow)", () => {
    it("Tue 01:00 without session → absent (past Mon 22:00 start)", () => {
      const window = resolveShiftWindow({
        anchorIso: "2026-05-19T01:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(shouldMarkAbsentNow(window, "2026-05-19T01:00:00.000Z", TZ)).toBe(true);
    });

    it("Tue 10:00 → not absent (between shift cycles)", () => {
      const window = resolveShiftWindow({
        anchorIso: "2026-05-19T10:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(shouldMarkAbsentNow(window, "2026-05-19T10:00:00.000Z", TZ)).toBe(false);
    });

    it("Mon 21:00 → not absent (before shift start)", () => {
      const window = resolveShiftWindow({
        anchorIso: "2026-05-18T21:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: true,
        shift: overnightShift,
      });
      expect(shouldMarkAbsentNow(window, "2026-05-18T21:00:00.000Z", TZ)).toBe(false);
    });

    it("daytime 10:00 past 09:00 start → absent", () => {
      const window = resolveShiftWindow({
        anchorIso: "2026-05-20T10:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: baseShift(),
      });
      expect(shouldMarkAbsentNow(window, "2026-05-20T10:00:00.000Z", TZ)).toBe(true);
    });
  });

  describe("pilot gate", () => {
    it("policy off never activates overnight logic even with spans_midnight shift", () => {
      const r = resolveShiftWindowAtCheckIn({
        checkInIso: "2026-05-19T01:00:00.000Z",
        businessTimeZone: TZ,
        overnightShiftsEnabled: false,
        shift: overnightShift,
      });
      expect(r.spansMidnight).toBe(false);
      expect(r.overnightLogicActive).toBe(false);
      expect(r.attendanceDateYmd).toBe(
        attendanceDateYmdFromCheckInUtcSlice("2026-05-19T01:00:00.000Z")
      );
    });
  });
});
