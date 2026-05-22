import {
  exportHoursWorkedDisplay,
  exportRegularMinutesDisplay,
  isSalaryDailyPayrollRecord,
  payrollRecordTypeLabel,
} from "../payrollSemantics";

describe("payrollSemantics", () => {
  it("labels salary_daily vs session_hourly", () => {
    expect(payrollRecordTypeLabel("salary_daily")).toBe("Monthly Day Credit");
    expect(payrollRecordTypeLabel("session_hourly")).toBe("Hourly Session");
  });

  it("export uses N/A for salary rows not zero", () => {
    const row = { record_type: "salary_daily", hours_worked: 0, regular_minutes: 0 };
    expect(isSalaryDailyPayrollRecord(row.record_type)).toBe(true);
    expect(exportHoursWorkedDisplay(row)).toBe("N/A (salary-based)");
    expect(exportRegularMinutesDisplay(row)).toBe("N/A (salary-based)");
  });

  it("export shows numeric values for hourly rows", () => {
    const row = {
      record_type: "session_hourly",
      hours_worked: 1.82,
      regular_minutes: 109,
    };
    expect(exportHoursWorkedDisplay(row)).toBe("1.82");
    expect(exportRegularMinutesDisplay(row)).toBe("109");
  });
});
