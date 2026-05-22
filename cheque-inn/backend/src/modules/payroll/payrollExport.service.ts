import * as payrollRepo from "./payroll.repository";
import * as usersRepo from "../users/users.repository";
import {
  exportAttendanceDayDisplay,
  exportHoursWorkedDisplay,
  exportOvertimeMinutesDisplay,
  exportRegularMinutesDisplay,
  payrollRecordTypeLabel,
} from "../../lib/payrollSemantics";

const CSV_HEADERS = [
  "Record Type",
  "Payroll Date",
  "Attendance Day",
  "Employee Name",
  "Hours Worked",
  "Regular Minutes",
  "Overtime Minutes",
  "Hourly Or Daily Rate",
  "Gross Earnings",
];

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportMonthlyPayroll(
  companyId: string,
  year: number,
  month: number
): Promise<string> {
  const records = await payrollRepo.getPayrollExportByMonth(
    companyId,
    year,
    month
  );

  const userIds = [...new Set(records.map((r) => r.user_id))];
  const userMap = new Map<string, string>();
  for (const uid of userIds) {
    const user = await usersRepo.findByIdAndCompanyId(uid, companyId);
    const name = user
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—"
      : "—";
    userMap.set(uid, name);
  }

  const rows: string[][] = [CSV_HEADERS];

  for (const r of records) {
    const employeeName = userMap.get(r.user_id) ?? "—";
    rows.push([
      payrollRecordTypeLabel(r.record_type),
      r.payroll_date ?? "",
      exportAttendanceDayDisplay(r),
      employeeName,
      exportHoursWorkedDisplay(r),
      exportRegularMinutesDisplay(r),
      exportOvertimeMinutesDisplay(r),
      String(r.hourly_rate ?? 0),
      String(r.gross_earnings ?? 0),
    ]);
  }

  const csv = rows
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\n");

  return csv;
}
