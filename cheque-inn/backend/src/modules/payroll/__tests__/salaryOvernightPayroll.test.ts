import { WorkSessionStatus } from "../../../constants/workSessionStatus";
import { sessionAttendanceDayForPayroll } from "../../../lib/sessionAttendanceDay";
import {
  aggregateLateMinutesByAttendanceDay,
  attendanceDayKeyForSession,
} from "../salaryEarnings.engine";
import { resolveSalarySyncYearMonth } from "../salaryEarnings.service";

describe("salary overnight payroll alignment", () => {
  describe("attendance ownership (shift-start business date)", () => {
    it("Mar 31 22:00 → Apr 1 06:00 session belongs to March when attendance_date is Mar 31", () => {
      const session = {
        attendance_date: "2026-03-31",
        check_in: "2026-04-01T01:00:00.000Z",
      };
      expect(sessionAttendanceDayForPayroll(session)).toBe("2026-03-31");
      expect(attendanceDayKeyForSession(session)).toBe("2026-03-31");
    });

    it("resolveSalarySyncYearMonth uses attendance_date not check-in month", () => {
      const r = resolveSalarySyncYearMonth("2026-04-01T06:00:00.000Z", "2026-03-31");
      expect(r.year).toBe(2026);
      expect(r.month).toBe(3);
      expect(r.attendanceYmd).toBe("2026-03-31");
    });

    it("falls back to check-in UTC day when attendance_date null", () => {
      const r = resolveSalarySyncYearMonth("2026-04-01T06:00:00.000Z", null);
      expect(r.attendanceYmd).toBe("2026-04-01");
      expect(r.month).toBe(4);
    });
  });

  describe("aggregateLateMinutesByAttendanceDay", () => {
    it("uses attendance_date for overnight late bucketing", () => {
      const m = aggregateLateMinutesByAttendanceDay([
        {
          check_in: "2026-04-01T01:00:00.000Z",
          attendance_date: "2026-03-31",
          status: WorkSessionStatus.COMPLETED,
          late_minutes: 45,
        },
      ]);
      expect(m.get("2026-03-31")).toBe(45);
      expect(m.has("2026-04-01")).toBe(false);
    });
  });
});
