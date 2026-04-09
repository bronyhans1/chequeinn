import * as leaveRepo from "../leave/leave.repository";
import * as usersRepo from "../users/users.repository";
import * as branchesRepo from "../branches/branches.repository";

export interface LeaveReportRow {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  branch_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string;
  reviewed_at: string | null;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function enrichLeaveReportRows(
  companyId: string,
  records: leaveRepo.LeaveRequestRecord[]
): Promise<LeaveReportRow[]> {
  if (records.length === 0) return [];

  const userIds = new Set<string>();
  for (const r of records) {
    userIds.add(r.user_id);
    if (r.approved_by) userIds.add(r.approved_by);
  }

  const ids = [...userIds];
  const users = await Promise.all(ids.map((id) => usersRepo.findByIdAndCompanyId(id, companyId)));
  const userMap = new Map<string, Awaited<ReturnType<typeof usersRepo.findByIdAndCompanyId>>>();
  ids.forEach((id, i) => {
    if (users[i]) userMap.set(id, users[i]);
  });

  const branchIds = [
    ...new Set(
      [...userMap.values()]
        .map((u) => u?.branch_id)
        .filter(Boolean) as string[]
    ),
  ];
  const branchMap = await branchesRepo.findByIds(branchIds);

  return records.map((r) => {
    const u = userMap.get(r.user_id);
    const name =
      r.employee_name?.trim() ||
      (u && [u.first_name, u.last_name].filter(Boolean).join(" ").trim()) ||
      u?.email ||
      "—";
    const email = r.employee_email ?? u?.email ?? "";
    const branchName =
      u?.branch_id && branchMap.get(u.branch_id) ? branchMap.get(u.branch_id)!.name : "";
    const reviewer = r.approved_by ? userMap.get(r.approved_by) : null;
    const reviewerName = reviewer
      ? [reviewer.first_name, reviewer.last_name].filter(Boolean).join(" ").trim() ||
        reviewer.email ||
        ""
      : "";
    return {
      id: r.id,
      user_id: r.user_id,
      employee_name: name,
      employee_email: email,
      branch_name: branchName,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      total_days: r.total_days,
      status: r.status,
      reason: r.reason,
      reviewed_by_id: r.approved_by,
      reviewed_by_name: reviewerName,
      reviewed_at: r.approved_at,
    };
  });
}

export async function getLeaveReportPage(
  companyId: string,
  rangeStart: string,
  rangeEnd: string,
  scopedUserIds: string[] | undefined,
  userId: string | undefined,
  status: string | undefined,
  page: number,
  limit: number
): Promise<{ rows: LeaveReportRow[]; total: number; period: { start: string; end: string } }> {
  const safePage = page > 0 ? page : 1;
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const offset = (safePage - 1) * safeLimit;

  const filterUserIds =
    scopedUserIds !== undefined && scopedUserIds !== null ? scopedUserIds : undefined;

  const { rows: raw, total } = await leaveRepo.listLeaveRequestsForReport(
    companyId,
    {
      rangeStart,
      rangeEnd,
      status: status ?? null,
      userId: userId ?? null,
      filterUserIds,
    },
    offset,
    safeLimit
  );

  const rows = await enrichLeaveReportRows(companyId, raw);
  return { rows, total, period: { start: rangeStart, end: rangeEnd } };
}

export async function buildLeaveReportCsv(
  companyId: string,
  rangeStart: string,
  rangeEnd: string,
  scopedUserIds: string[] | undefined,
  userId: string | undefined,
  status: string | undefined
): Promise<{ csv: string; rowCount: number }> {
  const filterUserIds =
    scopedUserIds !== undefined && scopedUserIds !== null ? scopedUserIds : undefined;

  const MAX = 10_000;
  const chunk = 2_000;
  const all: leaveRepo.LeaveRequestRecord[] = [];
  let offset = 0;

  while (all.length < MAX) {
    const { rows, total } = await leaveRepo.listLeaveRequestsForReport(
      companyId,
      {
        rangeStart,
        rangeEnd,
        status: status ?? null,
        userId: userId ?? null,
        filterUserIds,
      },
      offset,
      chunk
    );
    all.push(...rows);
    if (rows.length === 0 || all.length >= total) break;
    offset += chunk;
  }

  const sliced = all.slice(0, MAX);
  const truncated = all.length >= MAX;
  const rows = await enrichLeaveReportRows(companyId, sliced);

  const header = [
    "employee_name",
    "employee_email",
    "branch",
    "leave_type",
    "start_date",
    "end_date",
    "total_days",
    "status",
    "reviewed_by_name",
    "reviewed_at",
    "reason",
    "user_id",
    "leave_request_id",
  ];

  const lines = [
    truncated
      ? `# Truncated: first ${MAX} rows. Narrow filters or date range for full export.`
      : "",
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.employee_name),
        csvEscape(r.employee_email),
        csvEscape(r.branch_name),
        csvEscape(r.leave_type),
        csvEscape(r.start_date),
        csvEscape(r.end_date),
        csvEscape(r.total_days),
        csvEscape(r.status),
        csvEscape(r.reviewed_by_name),
        csvEscape(r.reviewed_at),
        csvEscape(r.reason),
        csvEscape(r.user_id),
        csvEscape(r.id),
      ].join(",")
    ),
  ].filter((l) => l !== "");

  return { csv: lines.join("\r\n"), rowCount: rows.length };
}
