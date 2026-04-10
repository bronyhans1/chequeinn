"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setAuthToken, clearAuthToken, getAuthToken } from "@/lib/api/client";
import * as authApi from "@/lib/api/auth.api";
import type { AppRole, AuthUser } from "@/lib/types/auth";
import { isApiError } from "@/lib/types/api";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  /** Set when the account or company is inactive/suspended (session cleared). */
  accountAccessBlocked: { message: string; code?: string } | null;
  clearAccountAccessBlocked: () => void;
  login: (
    email: string,
    password: string
  ) => Promise<{
    ok: boolean;
    accessBlocked?: boolean;
    error?: string;
    roles?: AppRole[];
  }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const THEME_KEY = "cheque_inn_theme_pref";
type ThemePref = "light" | "dark" | "system";

function applyTheme(pref: ThemePref) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = pref === "dark" || (pref === "system" && systemDark);
  root.classList.toggle("dark", dark);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accountAccessBlocked, setAccountAccessBlocked] = useState<{
    message: string;
    code?: string;
  } | null>(null);

  const clearAccountAccessBlocked = useCallback(() => setAccountAccessBlocked(null), []);

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as ThemePref | null) ?? "system";
    applyTheme(saved);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem(THEME_KEY) as ThemePref | null) ?? "system";
      if (current === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const pref = user?.themePreference ?? ((localStorage.getItem(THEME_KEY) as ThemePref | null) ?? "system");
    localStorage.setItem(THEME_KEY, pref);
    applyTheme(pref);
  }, [user?.themePreference]);

  const refreshUser = useCallback(async () => {
    const t = getAuthToken();
    if (!t) {
      setUser(null);
      setToken(null);
      setAccountAccessBlocked(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await authApi.getMe();
      if (isApiError(res)) {
        if (res.accessBlockCode) {
          setAccountAccessBlocked({ message: res.error, code: res.accessBlockCode });
        } else {
          setAccountAccessBlocked(null);
        }
        clearAuthToken();
        setUser(null);
        setToken(null);
        await supabase?.auth.signOut().catch(() => undefined);
        return;
      }
      setAccountAccessBlocked(null);
      setUser(res.data);
      setToken(t);
      localStorage.setItem(THEME_KEY, res.data.themePreference ?? "system");
      applyTheme((res.data.themePreference ?? "system") as ThemePref);
    } catch {
      setAccountAccessBlocked(null);
      clearAuthToken();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = getAuthToken();
    if (!t) {
      setIsLoading(false);
      return;
    }
    setToken(t);
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{
      ok: boolean;
      accessBlocked?: boolean;
      error?: string;
      roles?: AppRole[];
    }> => {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          return { ok: false, error: error.message };
        }
        const token = data.session?.access_token;
        if (!token) {
          return { ok: false, error: "No session" };
        }
        setAuthToken(token);
        setToken(token);
        const me = await authApi.getMe();
        if (isApiError(me)) {
          clearAuthToken();
          setToken(null);
          setUser(null);
          if (me.accessBlockCode) {
            setAccountAccessBlocked({ message: me.error, code: me.accessBlockCode });
            await supabase.auth.signOut().catch(() => undefined);
            return { ok: false, accessBlocked: true };
          }
          setAccountAccessBlocked(null);
          await supabase.auth.signOut().catch(() => undefined);
          return { ok: false, error: me.error };
        }
        setAccountAccessBlocked(null);
        setUser(me.data);
        localStorage.setItem(THEME_KEY, me.data.themePreference ?? "system");
        applyTheme((me.data.themePreference ?? "system") as ThemePref);
        return { ok: true, roles: me.data.roles };
      }
      return { ok: false, error: "Auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." };
    },
    []
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setToken(null);
    setAccountAccessBlocked(null);
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    accountAccessBlocked,
    clearAccountAccessBlocked,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
