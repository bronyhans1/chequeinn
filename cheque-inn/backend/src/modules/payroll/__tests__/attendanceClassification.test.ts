import {
  aggregateLateMinutesByAttendanceDay,
  classifyAttendanceDayByWorkedMinutes,
  normalizeAttendanceThresholds,
} from "../salaryEarnings.engine";
import { WorkSessionStatus } from "../../../constants/workSessionStatus";

describe("attendance day classification thresholds", () => {
  test("normalizeAttendanceThresholds clamps full to be >= min", () => {
    const th = normalizeAttendanceThresholds({
      minimum_minutes_for_counted_day: 500,
      full_day_minutes_threshold: 100,
      default_daily_hours: 8,
    });
    expect(th.min).toBe(500);
    expect(th.full).toBe(500);
  });

  test("classifyAttendanceDayByWorkedMinutes uses min and full only", () => {
    const th = { min: 60, full: 480 };
    expect(classifyAttendanceDayByWorkedMinutes(0, th).kind).toBe("not_counted");
    expect(classifyAttendanceDayByWorkedMinutes(59, th).kind).toBe("not_counted");
    expect(classifyAttendanceDayByWorkedMinutes(60, th).kind).toBe("half_day");
    expect(classifyAttendanceDayByWorkedMinutes(240, th).kind).toBe("half_day");
    expect(classifyAttendanceDayByWorkedMinutes(479, th).kind).toBe("half_day");
    expect(classifyAttendanceDayByWorkedMinutes(480, th).kind).toBe("full_day");
  });
});

describe("aggregateLateMinutesByAttendanceDay", () => {
  test("uses first completed late session of the day only", () => {
    const m = aggregateLateMinutesByAttendanceDay([
      {
        check_in: "2025-06-01T08:00:00.000Z",
        status: WorkSessionStatus.COMPLETED,
        late_minutes: 20,
      },
      {
        check_in: "2025-06-01T12:00:00.000Z",
        status: WorkSessionStatus.COMPLETED,
        late_minutes: 40,
      },
    ]);
    expect(m.get("2025-06-01")).toBe(20);
  });
});
