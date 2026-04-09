import {
  calendarYmdInTimeZone,
  normalizeBusinessTimeZone,
  yearMonthTodayInTimeZone,
} from "../businessCalendar";

describe("businessCalendar", () => {
  test("normalizeBusinessTimeZone falls back on garbage", () => {
    expect(normalizeBusinessTimeZone("Not/AZone")).toBe("UTC");
    expect(normalizeBusinessTimeZone(null)).toBe("UTC");
  });

  test("calendarYmdInTimeZone uses zone offset vs UTC", () => {
    const d = new Date("2026-04-07T23:30:00.000Z");
    const accra = calendarYmdInTimeZone(d, "Africa/Accra");
    expect(accra.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const utc = calendarYmdInTimeZone(d, "UTC");
    expect(utc.iso).toBe("2026-04-07");
  });

  test("yearMonthTodayInTimeZone returns consistent fields", () => {
    const d = new Date("2026-06-15T12:00:00.000Z");
    const r = yearMonthTodayInTimeZone(d, "UTC");
    expect(r.year).toBe(2026);
    expect(r.month).toBe(6);
    expect(r.todayIso).toBe("2026-06-15");
  });
});
