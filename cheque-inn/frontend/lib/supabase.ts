import { createClient } from "@supabase/supabase-js";
import { ENV } from "@/lib/env";

const supabaseUrl = ENV.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Temporary debug: confirms env is loaded in the client (do not log the key value).
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const urlSet = Boolean(supabaseUrl && supabaseUrl.length > 0);
  const keySet = Boolean(supabaseAnonKey && supabaseAnonKey.length > 0);
  console.log("[auth env] NEXT_PUBLIC_SUPABASE_URL:", urlSet ? "set" : "missing");
  console.log("[auth env] NEXT_PUBLIC_SUPABASE_ANON_KEY:", keySet ? "set" : "missing");
}

/** Browser Supabase client for auth only. Backend validates the token via GET /api/auth/me. */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          /** Parse `#access_token=…&type=recovery` (and related) from the email redirect URL. */
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
