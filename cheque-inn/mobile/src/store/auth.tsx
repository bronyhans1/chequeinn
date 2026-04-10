import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  getAuthToken,
  getRefreshToken,
  setAuthSession,
  clearAuthToken,
} from "@/lib/api/client";
import * as authApi from "@/lib/api/auth.api";
import type { AuthUser } from "@/types/auth";
import { isApiError } from "@/types/api";
import { ENV } from "@/lib/env";
import { isPlatformAdmin } from "@/lib/auth/roles";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** True when the signed-in account is PLATFORM_ADMIN — mobile is company-only; token is cleared. */
  platformAdminWebOnly: boolean;
  dismissPlatformAdminNotice: () => void;
  accountAccessBlocked: { message: string; code?: string } | null;
  clearAccountAccessBlocked: () => void;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; accessBlocked?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const supabaseUrl = ENV.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/** Shared mobile Supabase client for session-aware operations (e.g. updateUser password). */
export { supabase as mobileSupabase };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [platformAdminWebOnly, setPlatformAdminWebOnly] = useState(false);
  const [accountAccessBlocked, setAccountAccessBlocked] = useState<{
    message: string;
    code?: string;
  } | null>(null);

  const dismissPlatformAdminNotice = useCallback(() => {
    setPlatformAdminWebOnly(false);
  }, []);

  const clearAccountAccessBlocked = useCallback(() => setAccountAccessBlocked(null), []);

  const refreshUser = useCallback(async () => {
    const t = await getAuthToken();
    if (!t) {
      setUser(null);
      setPlatformAdminWebOnly(false);
      setAccountAccessBlocked(null);
      setIsLoading(false);
      return;
    }
    if (supabase) {
      const current = await supabase.auth.getSession();
      if (!current.data.session) {
        const refresh = await getRefreshToken();
        if (refresh) {
          await supabase.auth.setSession({
            access_token: t,
            refresh_token: refresh,
          });
        }
      }
    }
    try {
      const res = await authApi.getMe();
      if (isApiError(res)) {
        if (res.accessBlockCode) {
          setAccountAccessBlocked({ message: res.error, code: res.accessBlockCode });
        } else {
          setAccountAccessBlocked(null);
        }
        await clearAuthToken();
        setUser(null);
        setPlatformAdminWebOnly(false);
        if (supabase) await supabase.auth.signOut().catch(() => undefined);
        return;
      }
      if (isPlatformAdmin(res.data.roles)) {
        await clearAuthToken();
        setUser(null);
        setPlatformAdminWebOnly(true);
        return;
      }
      setAccountAccessBlocked(null);
      setPlatformAdminWebOnly(false);
      setUser(res.data);
    } catch {
      setAccountAccessBlocked(null);
      await clearAuthToken();
      setUser(null);
      setPlatformAdminWebOnly(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getAuthToken();
      if (!t) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      await refreshUser();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ ok: boolean; accessBlocked?: boolean; error?: string }> => {
      if (!supabase) {
        return {
          ok: false,
          error:
            "Auth not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
        };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      const token = data.session?.access_token;
      if (!token) {
        return { ok: false, error: "No session" };
      }
      await setAuthSession(token, data.session?.refresh_token ?? null);
      const res = await authApi.getMe();
      if (isApiError(res)) {
        await clearAuthToken();
        if (res.accessBlockCode) {
          setAccountAccessBlocked({ message: res.error, code: res.accessBlockCode });
          if (supabase) await supabase.auth.signOut().catch(() => undefined);
          return { ok: false, accessBlocked: true };
        }
        setAccountAccessBlocked(null);
        if (supabase) await supabase.auth.signOut().catch(() => undefined);
        return { ok: false, error: res.error ?? "Failed to load profile" };
      }
      if (isPlatformAdmin(res.data.roles)) {
        await clearAuthToken();
        setUser(null);
        setPlatformAdminWebOnly(true);
        setIsLoading(false);
        return { ok: false };
      }
      setAccountAccessBlocked(null);
      setPlatformAdminWebOnly(false);
      setUser(res.data);
      setIsLoading(false);
      return { ok: true };
    },
    []
  );

  const logout = useCallback(async () => {
    await clearAuthToken();
    setUser(null);
    setPlatformAdminWebOnly(false);
    setAccountAccessBlocked(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    platformAdminWebOnly,
    dismissPlatformAdminNotice,
    accountAccessBlocked,
    clearAccountAccessBlocked,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
