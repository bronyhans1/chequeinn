import ExcelJS from "exceljs";
import * as payrollRepo from "./payroll.repository";
import * as usersRepo from "../users/users.repository";
import {
  exportAttendanceDayDisplay,
  exportHoursWorkedDisplay,
  exportOvertimeMinutesDisplay,
  exportRegularMinutesDisplay,
  payrollRecordTypeLabel,
} from "../../lib/payrollSemantics";

const COLUMNS = [
  "Record Type",
  "Payroll Date",
  "Attendance Day",
  "Employee Name",
  "Hours Worked",
  "Regular Minutes",
  "Overtime Minutes",
  "Hourly Or Daily Rate",
  "Gross Earnings",
] as const;

export async function exportMonthlyPayrollExcel(
  companyId: string,
  year: number,
  month: number
): Promise<Buffer> {
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payroll", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.addRow(COLUMNS as unknown as string[]);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const r of records) {
    const employeeName = userMap.get(r.user_id) ?? "—";
    sheet.addRow([
      payrollRecordTypeLabel(r.record_type),
      r.payroll_date ?? "",
      exportAttendanceDayDisplay(r),
      employeeName,
      exportHoursWorkedDisplay(r),
      exportRegularMinutesDisplay(r),
      exportOvertimeMinutesDisplay(r),
      r.hourly_rate ?? 0,
      r.gross_earnings ?? 0,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
