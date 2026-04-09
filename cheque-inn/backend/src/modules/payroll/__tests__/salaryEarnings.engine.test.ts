import {
  aggregateLateMinutesByAttendanceDay,
  classifyDay,
  computeDailyRate,
  countPayableDivisorDays,
  holidayMap,
  hourlyEquivalentFromDailyRate,
  latePayDeductionFromLateMinutes,
  normalizeWorkingWeekdays,
  previousUtcYearMonth,
  salaryAttendanceDayFromCheckIn,
  utcYearMonthFromCalendarDate,
  utcWeekdayMon1Sun7,
} from "../salaryEarnings.engine";
import { WorkSessionStatus } from "../../../constants/workSessionStatus";

describe("salaryEarnings.engine", () => {
  test("utcWeekdayMon1Sun7: 2025-03-03 is Monday (1)", () => {
    expect(utcWeekdayMon1Sun7("2025-03-03")).toBe(1);
  });

  test("normalizeWorkingWeekdays: empty defaults to Mon–Fri", () => {
    expect(normalizeWorkingWeekdays([])).toEqual([1, 2, 3, 4, 5]);
    expect(normalizeWorkingWeekdays(undefined)).toEqual([1, 2, 3, 4, 5]);
  });

  test("classifyDay: unpaid holiday masks weekday", () => {
    const h = holidayMap([{ date: "2025-03-05", is_paid: false }]);
    const wd = [1, 2, 3, 4, 5];
    expect(classifyDay("2025-03-05", wd, h)).toEqual({ kind: "unpaid_holiday" });
  });

  test("classifyDay: paid holiday", () => {
    const h = holidayMap([{ date: "2025-03-05", is_paid: true }]);
    expect(classifyDay("2025-03-05", [1, 2, 3, 4, 5], h)).toEqual({ kind: "paid_holiday" });
  });

  test("classifyDay: Saturday is rest when Mon–Fri", () => {
    expect(classifyDay("2025-03-08", [1, 2, 3, 4, 5], new Map())).toEqual({ kind: "rest_day" });
  });

  test("countPayableDivisorDays: March 2025 weekdays minus unpaid on 5th", () => {
    const h = holidayMap([{ date: "2025-03-05", is_paid: false }]);
    const list = countPayableDivisorDays(2025, 3, [1, 2, 3, 4, 5], h);
    expect(list).not.toContain("2025-03-05");
    expect(list.length).toBeGreaterThan(10);
  });

  test("computeDailyRate: dynamic uses payable count", () => {
    expect(computeDailyRate(3000, "dynamic_working_days", 30, 20)).toBe(150);
  });

  test("computeDailyRate: fixed uses divisor value", () => {
    expect(computeDailyRate(3000, "fixed_days", 30, 99)).toBe(100);
  });

  test("salaryAttendanceDayFromCheckIn: uses UTC date prefix only", () => {
    expect(salaryAttendanceDayFromCheckIn("2025-03-31T22:00:00.000Z")).toBe("2025-03-31");
  });

  test("utcYearMonthFromCalendarDate", () => {
    expect(utcYearMonthFromCalendarDate("2025-03-31")).toEqual({ year: 2025, month: 3 });
  });

  test("previousUtcYearMonth", () => {
    expect(previousUtcYearMonth(2025, 3)).toEqual({ year: 2025, month: 2 });
    expect(previousUtcYearMonth(2025, 1)).toEqual({ year: 2024, month: 12 });
  });

  test("latePayDeductionFromLateMinutes: 60 min at 30/hr = 30", () => {
    expect(latePayDeductionFromLateMinutes(60, 30)).toBe(30);
  });

  test("hourlyEquivalentFromDailyRate: 150 day / 8 h = 18.75/h", () => {
    expect(hourlyEquivalentFromDailyRate(150, 8)).toBe(18.75);
  });

  test("aggregateLateMinutesByAttendanceDay uses earliest late session only", () => {
    const m = aggregateLateMinutesByAttendanceDay([
      {
        check_in: "2025-03-10T08:00:00.000Z",
        status: WorkSessionStatus.COMPLETED,
        late_minutes: 15,
      },
      {
        check_in: "2025-03-10T09:00:00.000Z",
        status: WorkSessionStatus.COMPLETED,
        late_minutes: 10,
      },
      { check_in: "2025-03-11T08:00:00.000Z", status: WorkSessionStatus.COMPLETED, late_minutes: 0 },
    ]);
    expect(m.get("2025-03-10")).toBe(15);
    expect(m.has("2025-03-11")).toBe(false);
  });
});
