import { supabaseAdmin } from "../../config/supabase";

export interface ShiftRecord {
  id: string;
  company_id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number | null;
  created_at: string;
}

export interface CreateShiftInput {
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number;
}

export interface UpdateShiftInput {
  name?: string;
  start_time?: string;
  end_time?: string;
  grace_minutes?: number;
}

export async function createShift(
  companyId: string,
  input: CreateShiftInput
): Promise<ShiftRecord> {
  const { data, error } = await supabaseAdmin
    .from("shifts")
    .insert({
      company_id: companyId,
      name: input.name,
      start_time: input.start_time,
      end_time: input.end_time,
      grace_minutes: input.grace_minutes ?? 0,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ShiftRecord;
}

export async function getShifts(
  companyId: string
): Promise<ShiftRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("shifts")
    .select("*")
    .eq("company_id", companyId)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ShiftRecord[];
}

export async function getShiftById(
  shiftId: string,
  companyId: string
): Promise<ShiftRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("shifts")
    .select("*")
    .eq("id", shiftId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if ((error as any).code === "PGRST116") return null;
    throw error;
  }

  return data as ShiftRecord;
}

export async function updateShift(
  id: string,
  companyId: string,
  input: UpdateShiftInput
): Promise<ShiftRecord | null> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.start_time !== undefined) payload.start_time = input.start_time;
  if (input.end_time !== undefined) payload.end_time = input.end_time;
  if (input.grace_minutes !== undefined) payload.grace_minutes = input.grace_minutes;

  if (Object.keys(payload).length === 0) return getShiftById(id, companyId);

  const { data, error } = await supabaseAdmin
    .from("shifts")
    .update(payload)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    if ((error as any).code === "PGRST116") return null;
    throw error;
  }

  return data as ShiftRecord;
}

export async function deleteShift(
  shiftId: string,
  companyId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("shifts")
    .delete()
    .eq("id", shiftId)
    .eq("company_id", companyId)
    .select("id")
    .single();

  if (error) {
    if ((error as any).code === "PGRST116") return false;
    throw error;
  }

  return !!data;
}

