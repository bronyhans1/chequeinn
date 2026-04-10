/**
 * Environment config. Next.js inlines only LITERAL process.env.NEXT_PUBLIC_* keys at build time.
 * Dynamic access (process.env[key]) is NOT inlined and stays undefined on the client.
 * Use direct property access so the bundler can replace them.
 */
export const ENV = {
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
