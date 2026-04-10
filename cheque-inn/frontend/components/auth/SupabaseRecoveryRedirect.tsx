"use client";

import { useEffect } from "react";

/**
 * Password-recovery emails using the implicit grant put tokens in the URL hash (`type=recovery`).
 * If Supabase Site URL is the marketing root (`/`), users land on `/` where no auth handler runs.
 * Forward them to `/reset-password` with the same search + hash so the reset page can apply the session.
 */
export function SupabaseRecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { pathname, hash, search, origin } = window.location;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));
    const isRecovery = params.get("type") === "recovery" || hash.includes("type=recovery");
    if (!isRecovery) return;

    if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) return;

    window.location.replace(`${origin}/reset-password${search}${hash}`);
  }, []);

  return null;
}
