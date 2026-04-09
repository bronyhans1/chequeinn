import { parseManualAttendanceFields } from "../manualAttendancePayload";

describe("parseManualAttendanceFields", () => {
  it("accepts a valid reason without note (non-other)", () => {
    const r = parseManualAttendanceFields({ reason: "missed_scan" });
    expect(r).toEqual({ ok: true, reason: "missed_scan", note: null });
  });

  it("requires note for other", () => {
    const r = parseManualAttendanceFields({ reason: "other" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("note");
  });

  it("accepts other with note", () => {
    const r = parseManualAttendanceFields({ reason: "other", note: "Forgot fob" });
    expect(r).toEqual({ ok: true, reason: "other", note: "Forgot fob" });
  });

  it("rejects invalid reason", () => {
    const r = parseManualAttendanceFields({ reason: "nope" });
    expect(r.ok).toBe(false);
  });
});
