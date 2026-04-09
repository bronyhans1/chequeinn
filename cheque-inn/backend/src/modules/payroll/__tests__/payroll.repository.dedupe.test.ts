import { supabaseAdmin } from "../../../config/supabase";
import * as repo from "../payroll.repository";

jest.mock("../../../config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

function wireUpsertReturning(row: unknown) {
  const single = jest.fn().mockResolvedValue({ data: row, error: null });
  const select = jest.fn(() => ({ single }));
  const upsert = jest.fn(() => ({ select }));
  jest.mocked(supabaseAdmin.from).mockReturnValue({ upsert } as unknown as ReturnType<typeof supabaseAdmin.from>);
  return { upsert, select, single };
}

describe("payroll.repository dedupe safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createPayrollRecord upserts by (record_type, session_id)", async () => {
    wireUpsertReturning({ id: "p1" });
    await repo.createPayrollRecord({
      user_id: "u1",
      company_id: "c1",
      session_id: "s1",
      regular_minutes: 10,
      overtime_minutes: 0,
      hours_worked: 0.17,
      hourly_rate: 12,
      gross_earnings: 2,
      payroll_date: "2026-03-01",
    });

    expect(jest.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("payroll_records");
    const fromRet = (jest.mocked(supabaseAdmin.from).mock.results[0]?.value ?? {}) as { upsert?: jest.Mock };
    expect(fromRet.upsert).toHaveBeenCalledTimes(1);
    expect(fromRet.upsert?.mock.calls[0]?.[1]).toEqual({ onConflict: "record_type,session_id" });
  });

  test("insertSalaryDailyRecord upserts by (record_type, user_id, company_id, earnings_date)", async () => {
    wireUpsertReturning({ id: "p2" });
    await repo.insertSalaryDailyRecord({
      user_id: "u1",
      company_id: "c1",
      earnings_date: "2026-03-02",
      gross_earnings: 100,
      daily_rate: 100,
    });

    const fromRet = (jest.mocked(supabaseAdmin.from).mock.results[0]?.value ?? {}) as { upsert?: jest.Mock };
    expect(fromRet.upsert).toHaveBeenCalledTimes(1);
    expect(fromRet.upsert?.mock.calls[0]?.[1]).toEqual({
      onConflict: "record_type,user_id,company_id,earnings_date",
    });
  });
});

