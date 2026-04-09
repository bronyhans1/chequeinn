import { supabaseAdmin } from "../../config/supabase";

/**
 * Get the effective hourly_rate for a user in a company as of sessionDate.
 * SELECT hourly_rate FROM wage_rates
 * WHERE user_id = ? AND company_id = ? AND effective_from <= sessionDate
 * ORDER BY effective_from DESC LIMIT 1
 */
export async function getHourlyRate(
  userId: string,
  companyId: string,
  sessionDateIso: string
): Promise<number | null> {
  const dateOnly = sessionDateIso.slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("wage_rates")
    .select("hourly_rate, rate_type")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .lte("effective_from", dateOnly)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as { hourly_rate?: number | null; rate_type?: string | null };
  const rt = row.rate_type ?? "hourly";
  if (rt === "monthly") return null;
  if (typeof row.hourly_rate !== "number" || row.hourly_rate <= 0) return null;
  return row.hourly_rate;
}
