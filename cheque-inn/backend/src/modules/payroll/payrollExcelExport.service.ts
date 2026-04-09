import ExcelJS from "exceljs";
import * as payrollRepo from "./payroll.repository";
import * as usersRepo from "../users/users.repository";

const COLUMNS = [
  "Payroll Date",
  "Employee Name",
  "Hours Worked",
  "Regular Minutes",
  "Overtime Minutes",
  "Hourly Rate",
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
      r.payroll_date ?? "",
      employeeName,
      r.hours_worked ?? 0,
      r.regular_minutes ?? 0,
      r.overtime_minutes ?? 0,
      r.hourly_rate ?? 0,
      r.gross_earnings ?? 0,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
