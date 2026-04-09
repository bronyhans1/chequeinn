import dotenv from "dotenv";

dotenv.config();

function parseThreshold(
  key: string,
  defaultValue: number
): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < 0) return defaultValue;
  return n;
}

export const ENV = {
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string,
  REPEATED_LATE_THRESHOLD: parseThreshold("REPEATED_LATE_THRESHOLD", 3),
  REPEATED_EARLY_LEAVE_THRESHOLD: parseThreshold("REPEATED_EARLY_LEAVE_THRESHOLD", 3),
  FREQUENT_HALF_DAY_THRESHOLD: parseThreshold("FREQUENT_HALF_DAY_THRESHOLD", 2),
  REPEATED_ABSENCE_THRESHOLD: parseThreshold("REPEATED_ABSENCE_THRESHOLD", 2),
};