import {
  computeAbsenceMap,
  getDatesInRange,
  isRepeatedAbsence,
} from "../absenceAggregation";

describe("getDatesInRange", () => {
  it("returns single day when start equals end", () => {
    const dates = getDatesInRange("2026-03-15", "2026-03-15");
    expect(dates).toEqual(["2026-03-15"]);
  });

  it("returns all days in range inclusive", () => {
    const dates = getDatesInRange("2026-03-01", "2026-03-05");
    expect(dates).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
  });

  it("returns empty when start is after end (invalid)", () => {
    const dates = getDatesInRange("2026-03-10", "2026-03-05");
    expect(dates).toEqual([]);
  });
});

describe("computeAbsenceMap", () => {
  const u1 = "user-1";
  const u2 = "user-2";

  it("returns empty map when no expected users", () => {
    const result = computeAbsenceMap(
      new Set(),
      ["2026-03-01", "2026-03-02"],
      new Set(),
      new Set()
    );
    expect(result.size).toBe(0);
  });

  it("returns empty map when no dates", () => {
    const result = computeAbsenceMap(
      new Set([u1]),
      [],
      new Set(),
      new Set()
    );
    expect(result.size).toBe(0);
  });

  it("marks all expected user-days as absent when session and leave sets empty", () => {
    const result = computeAbsenceMap(
      new Set([u1, u2]),
      ["2026-03-01", "2026-03-02"],
      new Set(),
      new Set()
    );
    expect(result.get(u1)).toEqual(["2026-03-01", "2026-03-02"]);
    expect(result.get(u2)).toEqual(["2026-03-01", "2026-03-02"]);
  });

  it("excludes user-days present in sessionSet", () => {
    const result = computeAbsenceMap(
      new Set([u1]),
      ["2026-03-01", "2026-03-02"],
      new Set([`${u1}_2026-03-01`]),
      new Set()
    );
    expect(result.get(u1)).toEqual(["2026-03-02"]);
  });

  it("excludes user-days present in leaveSet (leave exclusion)", () => {
    const result = computeAbsenceMap(
      new Set([u1]),
      ["2026-03-01", "2026-03-02"],
      new Set(),
      new Set([`${u1}_2026-03-02`])
    );
    expect(result.get(u1)).toEqual(["2026-03-01"]);
  });

  it("excludes when both session and leave (user has no absences, not in map)", () => {
    const result = computeAbsenceMap(
      new Set([u1]),
      ["2026-03-01", "2026-03-02"],
      new Set([`${u1}_2026-03-01`]),
      new Set([`${u1}_2026-03-02`])
    );
    expect(result.has(u1)).toBe(false);
    expect(result.get(u1)).toBeUndefined();
  });

  it("returns sorted absence dates per user", () => {
    const result = computeAbsenceMap(
      new Set([u1]),
      ["2026-03-03", "2026-03-01", "2026-03-02"],
      new Set(),
      new Set()
    );
    expect(result.get(u1)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("boundary: one user expected, one day, no session => one absence", () => {
    const result = computeAbsenceMap(
      new Set([u1]),
      ["2026-03-01"],
      new Set(),
      new Set()
    );
    expect(result.get(u1)).toEqual(["2026-03-01"]);
  });
});

describe("isRepeatedAbsence", () => {
  const threshold = 2;

  it("returns false when count is below threshold", () => {
    expect(isRepeatedAbsence(0, threshold)).toBe(false);
    expect(isRepeatedAbsence(1, threshold)).toBe(false);
  });

  it("returns true when count equals threshold", () => {
    expect(isRepeatedAbsence(2, threshold)).toBe(true);
  });

  it("returns true when count above threshold", () => {
    expect(isRepeatedAbsence(3, threshold)).toBe(true);
  });

  it("respects custom threshold", () => {
    expect(isRepeatedAbsence(2, 3)).toBe(false);
    expect(isRepeatedAbsence(3, 3)).toBe(true);
  });

  it("threshold zero: any count is repeated", () => {
    expect(isRepeatedAbsence(0, 0)).toBe(true);
    expect(isRepeatedAbsence(1, 0)).toBe(true);
  });
});
