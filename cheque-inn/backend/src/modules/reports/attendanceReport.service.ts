import ExcelJS from "exceljs";
import * as sessionsRepo from "../sessions/sessions.repository";
import * as usersRepo from "../users/users.repository";
import * as departmentsRepo from "../departments/departments.repository";
import * as branchesRepo from "../branches/branches.repository";
import type { WorkSessionRecord } from "../sessions/sessions.repository";

export interface AttendanceReportRow {
  session_id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  branch_name: string;
  department_name: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  duration_minutes: number | null;
  total_hours: number | null;
}

const MAX_EXPORT_ROWS = 10_000;
const PAGE_SIZE = 2_000;

function toStartIso(dateYmd: string): string {
  return `${dateYmd}T00:00:00.000Z`;
}

function toEndExclusiveIso(dateYmd: string): string {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function minutesWorked(s: WorkSessionRecord): number | null {
  if (typeof s.duration_minutes === "number") return s.duration_minutes;
  if (s.check_in && s.check_out) {
    return Math.floor(
      (new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000
    );
  }
  return null;
}

async function enrichSessionsToRows(
  sessions: WorkSessionRecord[],
  companyId: string
): Promise<AttendanceReportRow[]> {
  if (sessions.length === 0) return [];

  const departmentIds = [...new Set(sessions.map((s) => s.department_id).filter(Boolean))] as string[];
  const userIds = [...new Set(sessions.map((s) => s.user_id))];

  const [departments, users] = await Promise.all([
    Promise.all(departmentIds.map((id) => departmentsRepo.findByIdAndCompanyId(id, companyId))),
    Promise.all(userIds.map((id) => usersRepo.getUserById(id))),
  ]);

  const departmentName = new Map<string, string>();
  departmentIds.forEach((id, i) => {
    const d = departments[i];
    if (d) departmentName.set(id, d.name);
  });

  const branchIdsFromSessions = [
    ...new Set(sessions.map((s) => s.branch_id).filter(Boolean)),
  ] as string[];
  const branchIdsFromUsers = [
    ...new Set(users.map((u) => u?.branch_id).filter(Boolean)),
  ] as string[];
  const branchMap = await branchesRepo.findByIds([
    ...new Set([...branchIdsFromSessions, ...branchIdsFromUsers]),
  ]);

  return sessions.map((s) => {
    const u = users.find((x) => x?.id === s.user_id);
    const name =
      u && (u.first_name || u.last_name)
        ? [u.first_name, u.last_name].filter(Boolean).join(" ").trim()
        : u?.email ?? "";
    const attendanceBranchId = s.branch_id ?? u?.branch_id ?? null;
    const branchName =
      attendanceBranchId && branchMap.get(attendanceBranchId)
        ? branchMap.get(attendanceBranchId)!.name
        : "";
    return {
      session_id: s.id,
      user_id: s.user_id,
      employee_name: name || "—",
      employee_email: u?.email ?? "",
      branch_name: branchName,
      department_name: s.department_id ? departmentName.get(s.department_id) ?? "—" : "—",
      check_in: s.check_in,
      check_out: s.check_out,
      status: s.status,
      duration_minutes: minutesWorked(s),
      total_hours: s.total_hours ?? null,
    };
  });
}

export async function getAttendanceReportPage(
  companyId: string,
  startDateYmd: string,
  endDateYmd: string,
  scopedUserIds: string[] | undefined,
  userId: string | undefined,
  page: number,
  limit: number
): Promise<{ rows: AttendanceReportRow[]; total: number; period: { start: string; end: string } }> {
  const startIso = toStartIso(startDateYmd);
  const endIso = toEndExclusiveIso(endDateYmd);
  const safePage = page > 0 ? page : 1;
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const offset = (safePage - 1) * safeLimit;

  const { rows: raw, total } = await sessionsRepo.listSessionsForCompany(companyId, {
    startIso,
    endIso,
    userId,
    scopedUserIds,
    limit: safeLimit,
    offset,
  });

  const rows = await enrichSessionsToRows(raw, companyId);
  return {
    rows,
    total,
    period: { start: startDateYmd, end: endDateYmd },
  };
}

async function fetchAllSessionsForExport(
  companyId: string,
  startDateYmd: string,
  endDateYmd: string,
  scopedUserIds: string[] | undefined,
  userId: string | undefined
): Promise<WorkSessionRecord[]> {
  const startIso = toStartIso(startDateYmd);
  const endIso = toEndExclusiveIso(endDateYmd);
  const out: WorkSessionRecord[] = [];
  let offset = 0;

  while (out.length < MAX_EXPORT_ROWS) {
    const { rows, total } = await sessionsRepo.listSessionsForCompany(companyId, {
      startIso,
      endIso,
      userId,
      scopedUserIds,
      limit: PAGE_SIZE,
      offset,
    });
    out.push(...rows);
    if (rows.length === 0 || out.length >= total) break;
    offset += PAGE_SIZE;
  }

  return out.slice(0, MAX_EXPORT_ROWS);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildAttendanceReportCsv(
  companyId: string,
  startDateYmd: string,
  endDateYmd: string,
  scopedUserIds: string[] | undefined,
  userId: string | undefined
): Promise<{ csv: string; truncated: boolean; rowCount: number }> {
  const raw = await fetchAllSessionsForExport(
    companyId,
    startDateYmd,
    endDateYmd,
    scopedUserIds,
    userId
  );
  const { total } = await sessionsRepo.listSessionsForCompany(companyId, {
    startIso: toStartIso(startDateYmd),
    endIso: toEndExclusiveIso(endDateYmd),
    userId,
    scopedUserIds,
    limit: 1,
    offset: 0,
  });
  const truncated = total > MAX_EXPORT_ROWS;

  const rows = await enrichSessionsToRows(raw, companyId);
  const header = [
    "employee_name",
    "employee_email",
    "branch",
    "department",
    "check_in",
    "check_out",
    "status",
    "duration_minutes",
    "total_hours",
    "user_id",
    "session_id",
  ];

  const lines = [
    truncated
      ? `# Truncated: showing first ${MAX_EXPORT_ROWS} of ${total} rows. Narrow the date range or filter by employee.`
      : "",
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.employee_name),
        csvEscape(r.employee_email),
        csvEscape(r.branch_name),
        csvEscape(r.department_name),
        csvEscape(r.check_in),
        csvEscape(r.check_out),
        csvEscape(r.status),
        csvEscape(r.duration_minutes),
        csvEscape(r.total_hours),
        csvEscape(r.user_id),
        csvEscape(r.session_id),
      ].join(",")
    ),
  ].filter((l) => l !== "");

  return { csv: lines.join("\r\n"), truncated, rowCount: rows.length };
}

export async function buildAttendanceReportExcel(
  companyId: string,
  startDateYmd: string,
  endDateYmd: string,
  scopedUserIds: string[] | undefined,
  userId: string | undefined
): Promise<Buffer> {
  const raw = await fetchAllSessionsForExport(
    companyId,
    startDateYmd,
    endDateYmd,
    scopedUserIds,
    userId
  );
  const rows = await enrichSessionsToRows(raw, companyId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  sheet.addRow(["Attendance detail report"]);
  sheet.addRow([`Period: ${startDateYmd} to ${endDateYmd}`]);
  sheet.addRow([`Generated: ${new Date().toISOString()}`]);
  sheet.addRow([]);
  sheet.addRow([
    "Employee",
    "Email",
    "Branch",
    "Department",
    "Check-in",
    "Check-out",
    "Status",
    "Duration (min)",
    "Total hours",
    "User ID",
    "Session ID",
  ]);
  const hr = sheet.getRow(5);
  hr.font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.employee_name,
      r.employee_email,
      r.branch_name,
      r.department_name,
      r.check_in,
      r.check_out,
      r.status,
      r.duration_minutes,
      r.total_hours,
      r.user_id,
      r.session_id,
    ]);
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
