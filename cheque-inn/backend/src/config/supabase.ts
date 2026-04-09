import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY
);

export const supabaseAnon = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_ANON_KEY
);