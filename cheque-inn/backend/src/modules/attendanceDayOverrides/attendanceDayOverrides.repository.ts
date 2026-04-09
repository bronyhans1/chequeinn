import { supabaseAdmin } from "../../config/supabase";

export interface AttendanceDayOverrideRow {
  id: string;
  company_id: string;
  user_id: string;
  attendance_date: string; // YYYY-MM-DD
  day_units: number; // 0 | 0.5 | 1
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listForUserRange(
  companyId: string,
  userId: string,
  startYmd: string,
  endYmd: string
): Promise<AttendanceDayOverrideRow[]> {
  const { data, error } = await supabaseAdmin
    .from("attendance_day_overrides")
    .select("*")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .gte("attendance_date", startYmd)
    .lte("attendance_date", endYmd);

  if (error) throw error;
  return (data ?? []) as AttendanceDayOverrideRow[];
}

export async function upsertOverride(input: {
  company_id: string;
  user_id: string;
  attendance_date: string;
  day_units: number;
  note?: string | null;
  created_by?: string | null;
}): Promise<AttendanceDayOverrideRow> {
  const { data, error } = await supabaseAdmin
    .from("attendance_day_overrides")
    .upsert(
      {
        company_id: input.company_id,
        user_id: input.user_id,
        attendance_date: input.attendance_date,
        day_units: input.day_units,
        note: input.note ?? null,
        created_by: input.created_by ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,user_id,attendance_date" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as AttendanceDayOverrideRow;
}

export async function deleteOverride(
  companyId: string,
  userId: string,
  attendanceDate: string
): Promise<boolean> {
  const { error, data } = await supabaseAdmin
    .from("attendance_day_overrides")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("attendance_date", attendanceDate)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

