import { sessionAttendanceDayForPayroll } from "../sessionAttendanceDay";

describe("sessionAttendanceDayForPayroll", () => {
  it("prefers attendance_date when set (normalized to YYYY-MM-DD)", () => {
    expect(
      sessionAttendanceDayForPayroll({
        attendance_date: "2026-05-20",
        check_in: "2026-05-19T23:00:00.000Z",
      })
    ).toBe("2026-05-20");
  });

  it("coalesce: falls back to legacy UTC slice when attendance_date missing", () => {
    expect(
      sessionAttendanceDayForPayroll({
        attendance_date: null,
        check_in: "2026-05-19T23:45:00.000Z",
      })
    ).toBe("2026-05-19");
  });

  it("month boundary fallback matches check_in prefix", () => {
    expect(
      sessionAttendanceDayForPayroll({
        check_in: "2026-01-31T22:00:00.000Z",
      })
    ).toBe("2026-01-31");
  });

  it("returns null when no day can be derived", () => {
    expect(sessionAttendanceDayForPayroll({})).toBeNull();
    expect(sessionAttendanceDayForPayroll({ attendance_date: null, check_in: null })).toBeNull();
  });
});
