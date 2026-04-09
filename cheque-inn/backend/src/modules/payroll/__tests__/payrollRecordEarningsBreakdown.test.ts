import { payrollRecordEarningsBreakdown, type PayrollRecord } from "../payroll.repository";

function baseRecord(over: Partial<PayrollRecord> = {}): PayrollRecord {
  return {
    id: "1",
    user_id: "u",
    company_id: "c",
    session_id: null,
    regular_minutes: 0,
    overtime_minutes: 0,
    hours_worked: 1,
    hourly_rate: 10,
    gross_earnings: 100,
    payroll_date: "2026-04-01",
    ...over,
  };
}

describe("payrollRecordEarningsBreakdown", () => {
  test("legacy row: base equals net, no late", () => {
    const r = baseRecord({ gross_earnings: 80 });
    expect(payrollRecordEarningsBreakdown(r)).toEqual({
      net: 80,
      baseBeforeLate: 80,
      lateDeduction: 0,
    });
  });

  test("stored split: base, late, net", () => {
    const r = baseRecord({
      gross_earnings: 92,
      gross_before_late_deduction: 100,
      late_deduction_amount: 8,
    });
    expect(payrollRecordEarningsBreakdown(r)).toEqual({
      net: 92,
      baseBeforeLate: 100,
      lateDeduction: 8,
    });
  });

  test("infers base when late stored but base null", () => {
    const r = baseRecord({
      gross_earnings: 92,
      late_deduction_amount: 8,
    });
    expect(payrollRecordEarningsBreakdown(r).baseBeforeLate).toBe(100);
    expect(payrollRecordEarningsBreakdown(r).lateDeduction).toBe(8);
  });
});
