/**
 * Parity with frontend/lib/utils/shiftDisplay.ts (keep in sync).
 */
function parseHmToMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isOvernightWallClockSpan(startTime: string, endTime: string): boolean {
  const s = parseHmToMinutes(startTime);
  const e = parseHmToMinutes(endTime);
  if (s === null || e === null) return false;
  return e <= s;
}

function formatShiftTimeRange(params: {
  start_time: string;
  end_time: string;
  spans_midnight?: boolean;
}): string {
  const start = params.start_time?.slice(0, 5) ?? "—";
  const end = params.end_time?.slice(0, 5) ?? "—";
  const overnight =
    params.spans_midnight === true || isOvernightWallClockSpan(start, end);
  if (overnight) return `${start} → ${end} (next day)`;
  return `${start} → ${end}`;
}

describe("shiftDisplay parity", () => {
  it("formats overnight span with next day label", () => {
    expect(
      formatShiftTimeRange({
        start_time: "22:00",
        end_time: "06:00",
        spans_midnight: true,
      })
    ).toBe("22:00 → 06:00 (next day)");
  });

  it("same-day span has no next day label", () => {
    expect(
      formatShiftTimeRange({ start_time: "09:00", end_time: "17:00" })
    ).toBe("09:00 → 17:00");
  });
});
