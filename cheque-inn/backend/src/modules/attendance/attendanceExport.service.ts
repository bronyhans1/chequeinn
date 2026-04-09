import ExcelJS from "exceljs";
import * as attendanceService from "./attendance.service";
import type { ScopedUserIds } from "./attendance.repository";

const LATENESS_COLUMNS = [
  "Employee Name",
  "Late Count",
  "Total Late Minutes",
  "Average Late Minutes",
  "Repeated Late",
  "Latest Late At",
] as const;

const FLAGS_COLUMNS = [
  "Employee Name",
  "Late Count",
  "Total Late Minutes",
  "Average Late Minutes",
  "Early Leave Count",
  "Total Early Leave Minutes",
  "Half Day Count",
  "Repeated Late",
  "Repeated Early Leave",
  "Frequent Half Day",
  "Attention Needed",
  "Attendance Flag Level",
] as const;

function addReportMeta(
  sheet: ExcelJS.Worksheet,
  title: string,
  startDate: string,
  endDate: string
): void {
  sheet.addRow([title]);
  sheet.addRow([`Period: ${startDate} to ${endDate}`]);
  sheet.addRow([`Generated at: ${new Date().toISOString()}`]);
  sheet.addRow([]);
}

export async function exportLatenessSummaryExcel(
  companyId: string,
  startDate: string,
  endDate: string,
  scopedUserIds?: ScopedUserIds
): Promise<Buffer> {
  const result = await attendanceService.getLatenessSummary(
    companyId,
    startDate,
    endDate,
    scopedUserIds
  );
  const data = result.data ?? {
    period: { start: startDate, end: endDate },
    summary: { totalLateIncidents: 0, repeatedLateEmployees: 0 },
    employees: [],
  };
  const { period, employees } = data;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lateness Summary", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addReportMeta(sheet, "Lateness Summary", period.start, period.end);
  sheet.addRow(LATENESS_COLUMNS as unknown as string[]);
  const headerRow = sheet.getRow(5);
  headerRow.font = { bold: true };

  for (const e of employees) {
    sheet.addRow([
      e.name,
      e.late_count,
      e.total_late_minutes,
      e.average_late_minutes,
      e.repeated_late ? "Yes" : "No",
      e.latest_late_at ?? "",
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportFlagsSummaryExcel(
  companyId: string,
  startDate: string,
  endDate: string,
  scopedUserIds?: ScopedUserIds
): Promise<Buffer> {
  const result = await attendanceService.getFlagsSummary(
    companyId,
    startDate,
    endDate,
    scopedUserIds
  );
  const data = result.data ?? {
    period: { start: startDate, end: endDate },
    summary: { employeesFlagged: 0, highRiskEmployees: 0 },
    employees: [],
  };
  const { period, employees } = data;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance Flags", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addReportMeta(sheet, "Attendance Flags Summary", period.start, period.end);
  sheet.addRow(FLAGS_COLUMNS as unknown as string[]);
  const headerRow = sheet.getRow(5);
  headerRow.font = { bold: true };

  for (const e of employees) {
    sheet.addRow([
      e.name,
      e.late_count,
      e.total_late_minutes,
      e.average_late_minutes,
      e.early_leave_count,
      e.total_early_leave_minutes,
      e.half_day_count,
      e.repeated_late ? "Yes" : "No",
      e.repeated_early_leave ? "Yes" : "No",
      e.frequent_half_day ? "Yes" : "No",
      e.attention_needed ? "Yes" : "No",
      e.attendance_flag_level,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const ABSENCE_COLUMNS = [
  "Employee Name",
  "Absence Count",
  "Repeated Absence",
  "Absence Dates",
] as const;

export async function exportAbsenceSummaryExcel(
  companyId: string,
  startDate: string,
  endDate: string,
  listBranchId?: string
): Promise<Buffer> {
  const result = await attendanceService.getAbsenceSummary(
    companyId,
    startDate,
    endDate,
    listBranchId
  );
  const data = result.data ?? {
    period: { start: startDate, end: endDate },
    summary: { totalAbsenceIncidents: 0, employeesWithAbsences: 0 },
    employees: [],
  };
  const { period, employees } = data;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Absence Summary", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addReportMeta(sheet, "Absence Summary", period.start, period.end);
  sheet.addRow(ABSENCE_COLUMNS as unknown as string[]);
  const headerRow = sheet.getRow(5);
  headerRow.font = { bold: true };

  for (const e of employees) {
    sheet.addRow([
      e.name,
      e.absence_count,
      e.repeated_absence ? "Yes" : "No",
      e.absence_dates.join(", "),
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
