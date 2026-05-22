import {
  computeLateMinutesSameDay,
  computeOvertimeMinutesSameDay,
  expectedShiftDurationMinutes,
  isOvernightShiftSpan,
  isSameDayShiftSpan,
  parseTimeToMinutes,
} from "../shiftTimeModel";

describe("shiftTimeModel", () => {
  test("parseTimeToMinutes", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("22:30")).toBe(1350);
    expect(parseTimeToMinutes("bad")).toBeNull();
  });

  test("isSameDayShiftSpan vs overnight span", () => {
    expect(isSameDayShiftSpan(9 * 60, 17 * 60)).toBe(true);
    expect(isOvernightShiftSpan(22 * 60, 6 * 60)).toBe(true);
    expect(isSameDayShiftSpan(22 * 60, 6 * 60)).toBe(false);
  });

  describe("same-day lateness (16:00 shift, 15 min grace)", () => {
    const start = 16 * 60;
    const grace = 15;

    it("on time at 16:10", () => {
      expect(computeLateMinutesSameDay(16 * 60 + 10, start, grace)).toBe(0);
    });

    it("late at 16:20", () => {
      expect(computeLateMinutesSameDay(16 * 60 + 20, start, grace)).toBe(5);
    });
  });

  describe("same-day overtime (16:00–23:00 shift)", () => {
    const end = 23 * 60;

    it("no OT at 23:00", () => {
      expect(computeOvertimeMinutesSameDay(23 * 60, end)).toBe(0);
    });

    it("30m OT at 23:30", () => {
      expect(computeOvertimeMinutesSameDay(23 * 60 + 30, end)).toBe(30);
    });
  });

  describe("documented overnight limitations (22:00–06:00 span — not creatable via API)", () => {
    const start = 22 * 60;
    const end = 6 * 60;

    it("expected duration is 8h", () => {
      expect(expectedShiftDurationMinutes(start, end)).toBe(8 * 60);
    });

    it("1 AM check-in is treated as on-time (same-day compare bug)", () => {
      expect(computeLateMinutesSameDay(60, start, 0)).toBe(0);
    });

    it("11 PM checkout yields false overtime vs 06:00 end", () => {
      expect(computeOvertimeMinutesSameDay(23 * 60, end)).toBe(17 * 60);
    });
  });
});
