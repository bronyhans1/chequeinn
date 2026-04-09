import { supabaseAdmin } from "../../config/supabase";

export interface CompanyHolidayRecord {
  id: string;
  company_id: string;
  holiday_date: string;
  name: string;
  is_paid: boolean;
  created_at: string;
}

export async function getHolidayById(
  id: string,
  companyId: string
): Promise<CompanyHolidayRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("company_holidays")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as CompanyHolidayRecord | null;
}

export async function listHolidaysForCompanyRange(
  companyId: string,
  startInclusive: string,
  endInclusive: string
): Promise<CompanyHolidayRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("company_holidays")
    .select("*")
    .eq("company_id", companyId)
    .gte("holiday_date", startInclusive)
    .lte("holiday_date", endInclusive)
    .order("holiday_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CompanyHolidayRecord[];
}

export async function createHoliday(input: {
  company_id: string;
  holiday_date: string;
  name: string;
  is_paid: boolean;
}): Promise<CompanyHolidayRecord> {
  const { data, error } = await supabaseAdmin
    .from("company_holidays")
    .insert({
      company_id: input.company_id,
      holiday_date: input.holiday_date,
      name: input.name,
      is_paid: input.is_paid,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as CompanyHolidayRecord;
}

export async function deleteHoliday(id: string, companyId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("company_holidays")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function updateHoliday(
  id: string,
  companyId: string,
  data: { holiday_date?: string; name?: string; is_paid?: boolean }
): Promise<CompanyHolidayRecord | null> {
  const updates: Record<string, unknown> = {};
  if (data.holiday_date !== undefined) updates.holiday_date = data.holiday_date;
  if (data.name !== undefined) updates.name = data.name;
  if (data.is_paid !== undefined) updates.is_paid = data.is_paid;
  if (Object.keys(updates).length === 0) {
    return getHolidayById(id, companyId);
  }

  const { data: row, error } = await supabaseAdmin
    .from("company_holidays")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return row as CompanyHolidayRecord;
}
