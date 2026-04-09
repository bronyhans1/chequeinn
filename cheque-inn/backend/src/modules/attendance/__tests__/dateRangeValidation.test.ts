import { parseAndValidateDateRange } from "../dateRangeValidation";

describe("parseAndValidateDateRange", () => {
  it("accepts valid range", () => {
    const result = parseAndValidateDateRange("2025-01-01", "2025-01-31");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.start).toBe("2025-01-01");
      expect(result.end).toBe("2025-01-31");
    }
  });

  it("rejects missing start or end", () => {
    expect(parseAndValidateDateRange(undefined, "2025-01-31")).toEqual({
      error: "start and end are required as YYYY-MM-DD",
    });
    expect(parseAndValidateDateRange("2025-01-01", undefined)).toEqual({
      error: "start and end are required as YYYY-MM-DD",
    });
  });

  it("rejects invalid format", () => {
    expect(parseAndValidateDateRange("01-01-2025", "2025-01-31")).toEqual({
      error: "start and end are required as YYYY-MM-DD",
    });
    expect(parseAndValidateDateRange("2025-1-1", "2025-01-31")).toEqual({
      error: "start and end are required as YYYY-MM-DD",
    });
  });

  it("rejects start after end", () => {
    expect(parseAndValidateDateRange("2025-01-31", "2025-01-01")).toEqual({
      error: "start must be before or equal to end",
    });
  });

  it("accepts start equal to end", () => {
    const result = parseAndValidateDateRange("2025-01-15", "2025-01-15");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.start).toBe("2025-01-15");
      expect(result.end).toBe("2025-01-15");
    }
  });

  it("rejects range exceeding 366 days", () => {
    expect(parseAndValidateDateRange("2024-01-01", "2025-01-08")).toEqual({
      error: "Date range must not exceed 366 days",
    });
  });

  it("accepts 366-day range", () => {
    const result = parseAndValidateDateRange("2024-01-01", "2025-01-01");
    expect("error" in result).toBe(false);
  });
});
