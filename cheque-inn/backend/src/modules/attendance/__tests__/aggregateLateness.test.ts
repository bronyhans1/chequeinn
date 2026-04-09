import { aggregateLatenessByUser } from "../aggregateLateness";

describe("aggregateLatenessByUser", () => {
  it("aggregates by user and counts total incidents", () => {
    const rows = [
      { user_id: "u1", check_in: "2025-03-01T09:10:00Z", late_minutes: 10 },
      { user_id: "u1", check_in: "2025-03-02T09:05:00Z", late_minutes: 5 },
      { user_id: "u2", check_in: "2025-03-01T09:20:00Z", late_minutes: 20 },
    ];
    const result = aggregateLatenessByUser(rows, 3);
    expect(result.totalLateIncidents).toBe(3);
    expect(result.byUser.size).toBe(2);
    const u1 = result.byUser.get("u1")!;
    expect(u1.late_count).toBe(2);
    expect(u1.total_late_minutes).toBe(15);
    expect(u1.latest_check_in).toBe("2025-03-02T09:05:00Z");
    const u2 = result.byUser.get("u2")!;
    expect(u2.late_count).toBe(1);
    expect(u2.total_late_minutes).toBe(20);
  });

  it("dedupes multiple late sessions on the same calendar day (earliest check-in wins)", () => {
    const rows = [
      { user_id: "u1", check_in: "2025-04-01T10:00:00Z", late_minutes: 30 },
      { user_id: "u1", check_in: "2025-04-01T14:00:00Z", late_minutes: 10 },
    ];
    const result = aggregateLatenessByUser(rows, 3);
    expect(result.totalLateIncidents).toBe(1);
    const u1 = result.byUser.get("u1")!;
    expect(u1.late_count).toBe(1);
    expect(u1.total_late_minutes).toBe(30);
    expect(u1.latest_check_in).toBe("2025-04-01T10:00:00Z");
  });

  it("repeated_late threshold: 3 or more counts as repeated", () => {
    const rows = [
      { user_id: "u1", check_in: "2025-03-01T09:00:00Z", late_minutes: 5 },
      { user_id: "u1", check_in: "2025-03-02T09:00:00Z", late_minutes: 5 },
      { user_id: "u1", check_in: "2025-03-03T09:00:00Z", late_minutes: 5 },
      { user_id: "u2", check_in: "2025-03-01T09:00:00Z", late_minutes: 5 },
      { user_id: "u2", check_in: "2025-03-02T09:00:00Z", late_minutes: 5 },
    ];
    const result = aggregateLatenessByUser(rows, 3);
    expect(result.repeatedLateCount).toBe(1);
    expect(result.byUser.get("u1")!.late_count).toBe(3);
    expect(result.byUser.get("u2")!.late_count).toBe(2);
  });

  it("custom threshold 5: only 5+ lates count as repeated", () => {
    const rows = [
      { user_id: "u1", check_in: "2025-03-01T09:00:00Z", late_minutes: 1 },
      { user_id: "u1", check_in: "2025-03-02T09:00:00Z", late_minutes: 1 },
      { user_id: "u1", check_in: "2025-03-03T09:00:00Z", late_minutes: 1 },
      { user_id: "u1", check_in: "2025-03-04T09:00:00Z", late_minutes: 1 },
    ];
    expect(aggregateLatenessByUser(rows, 5).repeatedLateCount).toBe(0);
    expect(aggregateLatenessByUser(rows, 4).repeatedLateCount).toBe(1);
  });

  it("skips rows with missing user_id", () => {
    const rows = [
      { user_id: "", check_in: "2025-03-01T09:00:00Z", late_minutes: 10 },
      { user_id: "u1", check_in: "2025-03-01T09:05:00Z", late_minutes: 5 },
    ];
    const result = aggregateLatenessByUser(rows, 3);
    expect(result.totalLateIncidents).toBe(1);
    expect(result.byUser.size).toBe(1);
    expect(result.byUser.get("u1")!.late_count).toBe(1);
  });

  it("empty rows returns zeros", () => {
    const result = aggregateLatenessByUser([], 3);
    expect(result.totalLateIncidents).toBe(0);
    expect(result.repeatedLateCount).toBe(0);
    expect(result.byUser.size).toBe(0);
  });
});
