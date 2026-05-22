import { mergeOpenSessionIntoTodayRows } from "../sessions.service";
import type { WorkSessionRecord } from "../sessions.repository";

function row(partial: Partial<WorkSessionRecord> & { id: string }): WorkSessionRecord {
  return {
    company_id: "c1",
    user_id: "u1",
    check_in: "2026-03-31T22:00:00.000Z",
    check_out: null,
    status: "active",
    created_at: "2026-03-31T22:00:00.000Z",
    attendance_date: "2026-03-31",
    ...partial,
  } as WorkSessionRecord;
}

describe("mergeOpenSessionIntoTodayRows", () => {
  it("appends overnight open session when missing from today filter", () => {
    const open = row({
      id: "overnight-1",
      attendance_date: "2026-03-31",
      check_in: "2026-03-31T22:00:00.000Z",
    });
    const merged = mergeOpenSessionIntoTodayRows([], open);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("overnight-1");
  });

  it("does not duplicate when open session already in today rows", () => {
    const open = row({ id: "s1" });
    const merged = mergeOpenSessionIntoTodayRows([open], open);
    expect(merged).toHaveLength(1);
  });

  it("returns today rows when open is null", () => {
    const today = [row({ id: "s2", status: "completed", check_out: "2026-04-01T06:00:00.000Z" })];
    expect(mergeOpenSessionIntoTodayRows(today, null)).toEqual(today);
  });
});
