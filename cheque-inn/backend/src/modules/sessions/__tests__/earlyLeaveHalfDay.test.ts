import { computeEarlyLeaveAndHalfDay } from "../earlyLeaveHalfDay";

describe("computeEarlyLeaveAndHalfDay", () => {
  const day = "2025-03-15";

  describe("same-day shift (09:00–17:00)", () => {
    const startM = 9 * 60;
    const endM = 17 * 60;
    const expectedMinutes = 8 * 60;

    it("on-time checkout: early_leave = 0, half_day = false", () => {
      const checkIn = `${day}T09:00:00.000Z`;
      const checkOut = `${day}T17:00:00.000Z`;
      const duration = expectedMinutes;
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(0);
      expect(result.halfDay).toBe(false);
    });

    it("early checkout: early_leave = 60, half_day = false", () => {
      const checkIn = `${day}T09:00:00.000Z`;
      const checkOut = `${day}T16:00:00.000Z`;
      const duration = 7 * 60;
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(60);
      expect(result.halfDay).toBe(false);
    });

    it("half_day true when worked < 50% of shift", () => {
      const checkIn = `${day}T09:00:00.000Z`;
      const checkOut = `${day}T12:00:00.000Z`;
      const duration = 3 * 60;
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(5 * 60);
      expect(result.halfDay).toBe(true);
    });

    it("half_day false when worked >= 50% of shift", () => {
      const checkIn = `${day}T09:00:00.000Z`;
      const checkOut = `${day}T13:00:00.000Z`;
      const duration = 4 * 60;
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(4 * 60);
      expect(result.halfDay).toBe(false);
    });
  });

  describe("overnight shift (22:00–06:00)", () => {
    const startM = 22 * 60;
    const endM = 6 * 60;
    const expectedMinutes = 8 * 60;

    it("on-time checkout (next day 06:00): early_leave = 0, half_day = false", () => {
      const checkIn = `${day}T22:00:00.000Z`;
      const checkOut = "2025-03-16T06:00:00.000Z";
      const duration = expectedMinutes;
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(0);
      expect(result.halfDay).toBe(false);
    });

    it("early checkout (next day 02:00): early_leave = 240, half_day = false (exactly 50% worked)", () => {
      const checkIn = `${day}T22:00:00.000Z`;
      const checkOut = "2025-03-16T02:00:00.000Z";
      const duration = 4 * 60; // 240 min = 50% of 480 min shift
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(4 * 60);
      expect(result.halfDay).toBe(false); // strictly less than 50% is half_day; 50% is not
    });

    it("late checkout (next day 08:00): early_leave = 0", () => {
      const checkIn = `${day}T22:00:00.000Z`;
      const checkOut = "2025-03-16T08:00:00.000Z";
      const duration = 10 * 60;
      const result = computeEarlyLeaveAndHalfDay(
        startM,
        endM,
        checkIn,
        checkOut,
        duration
      );
      expect(result.earlyLeaveMinutes).toBe(0);
      expect(result.halfDay).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("negative duration returns 0 early, false half_day", () => {
      const result = computeEarlyLeaveAndHalfDay(
        9 * 60,
        17 * 60,
        `${day}T09:00:00.000Z`,
        `${day}T17:00:00.000Z`,
        -10
      );
      expect(result.earlyLeaveMinutes).toBe(0);
      expect(result.halfDay).toBe(false);
    });

    it("zero expected shift duration returns 0 early, false half_day", () => {
      const result = computeEarlyLeaveAndHalfDay(
        17 * 60,
        17 * 60,
        `${day}T09:00:00.000Z`,
        `${day}T17:00:00.000Z`,
        60
      );
      expect(result.earlyLeaveMinutes).toBe(0);
      expect(result.halfDay).toBe(false);
    });
  });
});
