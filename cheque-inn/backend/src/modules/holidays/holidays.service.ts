import * as repo from "./holidays.repository";

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

export async function listHolidays(
  companyId: string,
  year: number,
  month: number
): Promise<repo.CompanyHolidayRecord[]> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return repo.listHolidaysForCompanyRange(companyId, start, end);
}

export async function createHoliday(
  companyId: string,
  body: { holiday_date: unknown; name: unknown; is_paid: unknown }
): Promise<{ data?: repo.CompanyHolidayRecord; error?: string }> {
  const holiday_date = parseDate(body.holiday_date);
  if (!holiday_date) return { error: "holiday_date must be YYYY-MM-DD" };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "name is required" };
  const is_paid = body.is_paid === false ? false : true;

  try {
    const row = await repo.createHoliday({
      company_id: companyId,
      holiday_date,
      name,
      is_paid,
    });
    return { data: row };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create holiday";
    if (String(msg).toLowerCase().includes("duplicate") || String(msg).includes("23505")) {
      return { error: "A holiday already exists on this date" };
    }
    return { error: msg };
  }
}

export async function deleteHoliday(
  id: string,
  companyId: string
): Promise<{ ok: boolean; error?: string; deleted?: repo.CompanyHolidayRecord }> {
  const existing = await repo.getHolidayById(id, companyId);
  if (!existing) return { ok: false, error: "Holiday not found" };
  const ok = await repo.deleteHoliday(id, companyId);
  if (!ok) return { ok: false, error: "Holiday not found" };
  return { ok: true, deleted: existing };
}

export async function updateHoliday(
  companyId: string,
  id: string,
  body: { holiday_date?: unknown; name?: unknown; is_paid?: unknown }
): Promise<{ data?: repo.CompanyHolidayRecord; error?: string }> {
  const updates: { holiday_date?: string; name?: string; is_paid?: boolean } = {};
  if (body.holiday_date !== undefined) {
    const d = parseDate(body.holiday_date);
    if (!d) return { error: "holiday_date must be YYYY-MM-DD when provided" };
    updates.holiday_date = d;
  }
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "name cannot be empty when provided" };
    updates.name = name;
  }
  if (body.is_paid !== undefined) {
    updates.is_paid = body.is_paid === false ? false : true;
  }
  if (Object.keys(updates).length === 0) {
    return { error: "No fields to update" };
  }
  try {
    const row = await repo.updateHoliday(id, companyId, updates);
    if (!row) return { error: "Holiday not found" };
    return { data: row };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update holiday";
    if (String(msg).toLowerCase().includes("duplicate") || String(msg).includes("23505")) {
      return { error: "A holiday already exists on this date" };
    }
    return { error: msg };
  }
}
