import {
  postgrestOrFilterForAttendanceDayInRange,
  postgrestOrFilterForAttendanceOnBusinessDay,
} from "../sessionAttendanceQuery";

describe("sessionAttendanceQuery", () => {
  it("business day filter prefers attendance_date with check_in fallback", () => {
    const f = postgrestOrFilterForAttendanceOnBusinessDay({
      todayYmd: "2026-05-20",
      startIso: "2026-05-20T00:00:00.000Z",
      endIso: "2026-05-21T00:00:00.000Z",
    });
    expect(f).toContain("attendance_date.eq.2026-05-20");
    expect(f).toContain("attendance_date.is.null");
    expect(f).toContain("check_in.gte");
  });

  it("range filter uses inclusive attendance_date bounds", () => {
    const f = postgrestOrFilterForAttendanceDayInRange({
      startYmd: "2026-05-01",
      endYmd: "2026-05-31",
      startIso: "2026-05-01T00:00:00.000Z",
      endIso: "2026-06-01T00:00:00.000Z",
    });
    expect(f).toContain("attendance_date.gte.2026-05-01");
    expect(f).toContain("attendance_date.lte.2026-05-31");
  });
});
