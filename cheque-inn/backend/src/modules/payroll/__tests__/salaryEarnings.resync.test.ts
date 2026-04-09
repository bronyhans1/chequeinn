import {
  dedupeYearMonths,
  mergeYearMonthLists,
  previousUtcYearMonth,
  ymTodayUtc,
} from "../salaryEarnings.engine";

describe("salary earnings month helpers", () => {
  test("dedupeYearMonths merges duplicates", () => {
    expect(dedupeYearMonths([{ year: 2025, month: 3 }, { year: 2025, month: 3 }, { year: 2025, month: 2 }])).toEqual([
      { year: 2025, month: 3 },
      { year: 2025, month: 2 },
    ]);
  });

  test("mergeYearMonthLists dedupes", () => {
    expect(
      mergeYearMonthLists([{ year: 2025, month: 1 }], [{ year: 2025, month: 1 }, { year: 2024, month: 12 }])
    ).toEqual([
      { year: 2025, month: 1 },
      { year: 2024, month: 12 },
    ]);
  });

  test("UTC buffer = current month + previous (live resync shape)", () => {
    const { year, month } = ymTodayUtc();
    const m = dedupeYearMonths([{ year, month }, previousUtcYearMonth(year, month)]);
    expect(m.length).toBe(2);
  });
});
