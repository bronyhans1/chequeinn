import {
  aggregateSessionsForFlags,
  computeFlags,
  type FlagSessionRow,
  type FlagThresholds,
} from "../attendanceFlags";

describe("aggregateSessionsForFlags", () => {
  it("aggregates late, early leave, and half_day per user", () => {
    const rows: FlagSessionRow[] = [
      {
        user_id: "u1",
        check_in: "2025-01-01T08:00:00.000Z",
        late_minutes: 10,
        early_leave_minutes: 0,
        half_day: false,
      },
      {
        user_id: "u1",
        check_in: "2025-01-02T09:00:00.000Z",
        late_minutes: 5,
        early_leave_minutes: 30,
        half_day: true,
      },
      {
        user_id: "u2",
        check_in: "2025-01-01T10:00:00.000Z",
        late_minutes: 0,
        early_leave_minutes: 15,
        half_day: false,
      },
    ];
    const byUser = aggregateSessionsForFlags(rows);
    expect(byUser.size).toBe(2);
    const u1 = byUser.get("u1")!;
    expect(u1.late_count).toBe(2);
    expect(u1.total_late_minutes).toBe(15);
    expect(u1.early_leave_count).toBe(1);
    expect(u1.total_early_leave_minutes).toBe(30);
    expect(u1.half_day_count).toBe(1);
    const u2 = byUser.get("u2")!;
    expect(u2.late_count).toBe(0);
    expect(u2.total_late_minutes).toBe(0);
    expect(u2.early_leave_count).toBe(1);
    expect(u2.half_day_count).toBe(0);
  });

  it("counts lateness once per calendar day (earliest session wins)", () => {
    const rows: FlagSessionRow[] = [
      {
        user_id: "u1",
        check_in: "2025-01-01T10:00:00.000Z",
        late_minutes: 30,
        early_leave_minutes: 0,
        half_day: false,
      },
      {
        user_id: "u1",
        check_in: "2025-01-01T14:00:00.000Z",
        late_minutes: 10,
        early_leave_minutes: 0,
        half_day: false,
      },
    ];
    const byUser = aggregateSessionsForFlags(rows);
    const u1 = byUser.get("u1")!;
    expect(u1.late_count).toBe(1);
    expect(u1.total_late_minutes).toBe(30);
  });

  it("ignores zero and null late/early_leave", () => {
    const rows: FlagSessionRow[] = [
      { user_id: "u1", check_in: "2025-02-01T08:00:00.000Z", late_minutes: 0, early_leave_minutes: null, half_day: false },
      { user_id: "u1", check_in: "2025-02-02T08:00:00.000Z", late_minutes: null, early_leave_minutes: 0, half_day: false },
    ];
    const byUser = aggregateSessionsForFlags(rows);
    const u1 = byUser.get("u1")!;
    expect(u1.late_count).toBe(0);
    expect(u1.total_late_minutes).toBe(0);
    expect(u1.early_leave_count).toBe(0);
    expect(u1.half_day_count).toBe(0);
  });

  it("skips rows with missing user_id", () => {
    const rows: FlagSessionRow[] = [
      { user_id: "", check_in: "2025-03-01T09:00:00.000Z", late_minutes: 10, early_leave_minutes: 0, half_day: false },
      { user_id: "u1", check_in: "2025-03-01T09:05:00.000Z", late_minutes: 5, early_leave_minutes: 0, half_day: false },
    ];
    const byUser = aggregateSessionsForFlags(rows);
    expect(byUser.size).toBe(1);
  });

  it("returns empty map for empty rows", () => {
    const byUser = aggregateSessionsForFlags([]);
    expect(byUser.size).toBe(0);
  });
});

describe("computeFlags", () => {
  const defaultThresholds: FlagThresholds = {
    repeatedLate: 3,
    repeatedEarlyLeave: 3,
    frequentHalfDay: 2,
  };

  it("none: no thresholds triggered", () => {
    const stats = {
      late_count: 1,
      total_late_minutes: 5,
      early_leave_count: 1,
      total_early_leave_minutes: 10,
      half_day_count: 0,
    };
    const flags = computeFlags(stats, defaultThresholds);
    expect(flags.repeated_late).toBe(false);
    expect(flags.repeated_early_leave).toBe(false);
    expect(flags.frequent_half_day).toBe(false);
    expect(flags.attention_needed).toBe(false);
    expect(flags.attendance_flag_level).toBe("none");
  });

  it("low: one threshold triggered", () => {
    const stats = {
      late_count: 3,
      total_late_minutes: 30,
      early_leave_count: 0,
      total_early_leave_minutes: 0,
      half_day_count: 0,
    };
    const flags = computeFlags(stats, defaultThresholds);
    expect(flags.repeated_late).toBe(true);
    expect(flags.repeated_early_leave).toBe(false);
    expect(flags.frequent_half_day).toBe(false);
    expect(flags.attention_needed).toBe(true);
    expect(flags.attendance_flag_level).toBe("low");
  });

  it("medium: two thresholds triggered", () => {
    const stats = {
      late_count: 4,
      total_late_minutes: 40,
      early_leave_count: 0,
      total_early_leave_minutes: 0,
      half_day_count: 3,
    };
    const flags = computeFlags(stats, defaultThresholds);
    expect(flags.repeated_late).toBe(true);
    expect(flags.repeated_early_leave).toBe(false);
    expect(flags.frequent_half_day).toBe(true);
    expect(flags.attention_needed).toBe(true);
    expect(flags.attendance_flag_level).toBe("medium");
  });

  it("high: all three thresholds triggered", () => {
    const stats = {
      late_count: 5,
      total_late_minutes: 50,
      early_leave_count: 5,
      total_early_leave_minutes: 50,
      half_day_count: 4,
    };
    const flags = computeFlags(stats, defaultThresholds);
    expect(flags.repeated_late).toBe(true);
    expect(flags.repeated_early_leave).toBe(true);
    expect(flags.frequent_half_day).toBe(true);
    expect(flags.attention_needed).toBe(true);
    expect(flags.attendance_flag_level).toBe("high");
  });
});
