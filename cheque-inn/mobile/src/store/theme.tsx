import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

export type ThemePreference = "light" | "dark" | "system";

type ThemeMode = "light" | "dark";

export interface ThemePalette {
  background: string;
  surface: string;
  /** Cards / elevated panels */
  surfaceMuted: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  /** Success accents (checklist, positive states) */
  success: string;
  /** Warning / in-progress (leave pending, active session) */
  warning: string;
  /** Error text */
  danger: string;
  /** Subtle danger / warning surfaces */
  surfaceDanger: string;
  surfaceWarning: string;
  /** Filled primary button label */
  onPrimary: string;
  /** Text/icons on camera / dark overlays */
  onOverlay: string;
  /** Semi-opaque scrim over camera */
  overlayScrim: string;
  /** Status chips — backgrounds + text (leave + attendance) */
  toneSuccessBg: string;
  toneSuccessText: string;
  toneDangerBg: string;
  toneDangerText: string;
  toneWarningBg: string;
  toneWarningText: string;
  toneNeutralBg: string;
  toneNeutralText: string;
  /** Secondary actions (outlined buttons) */
  secondaryBorder: string;
  /** Tab bar / chrome */
  tabBar: string;
  /** iOS/Android shadow (neutral) */
  shadow: string;
  /** Legible shadow for light text on imagery (e.g. camera hint) */
  hintShadow: string;
}

interface ThemeContextValue {
  preference: ThemePreference;
  mode: ThemeMode;
  colors: ThemePalette;
  setPreference: (v: ThemePreference) => Promise<void>;
}

const KEY = "cheque_inn_theme_pref";

const LIGHT: ThemePalette = {
  background: "#e8ecf3",
  surface: "#ffffff",
  surfaceMuted: "#f2f5f9",
  text: "#0f172a",
  muted: "#64748b",
  border: "#dfe4ec",
  primary: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  surfaceDanger: "#fef2f2",
  surfaceWarning: "#fffbeb",
  onPrimary: "#ffffff",
  onOverlay: "#ffffff",
  overlayScrim: "rgba(15, 23, 42, 0.55)",
  toneSuccessBg: "#ecfdf5",
  toneSuccessText: "#166534",
  toneDangerBg: "#fef2f2",
  toneDangerText: "#991b1b",
  toneWarningBg: "#fffbeb",
  toneWarningText: "#92400e",
  toneNeutralBg: "#f1f5f9",
  toneNeutralText: "#475569",
  secondaryBorder: "#bfdbfe",
  tabBar: "#fcfdff",
  shadow: "#0f172a",
  hintShadow: "rgba(0, 0, 0, 0.72)",
};

const DARK: ThemePalette = {
  background: "#070b14",
  surface: "#111a2c",
  surfaceMuted: "#0c1322",
  text: "#e8edf4",
  muted: "#8b9ab5",
  border: "#243045",
  primary: "#60a5fa",
  success: "#4ade80",
  warning: "#fbbf24",
  danger: "#f87171",
  surfaceDanger: "#1f1315",
  surfaceWarning: "#1a1508",
  onPrimary: "#ffffff",
  onOverlay: "#ffffff",
  overlayScrim: "rgba(0, 0, 0, 0.62)",
  toneSuccessBg: "#064e3b",
  toneSuccessText: "#6ee7b7",
  toneDangerBg: "#450a0a",
  toneDangerText: "#fca5a5",
  toneWarningBg: "#78350f",
  toneWarningText: "#fde68a",
  toneNeutralBg: "#1f2937",
  toneNeutralText: "#94a3b8",
  secondaryBorder: "#334155",
  tabBar: "#101827",
  shadow: "#000000",
  hintShadow: "rgba(0, 0, 0, 0.78)",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setPreferenceState(saved);
      }
    })();
  }, []);

  const mode: ThemeMode =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  const colors = mode === "dark" ? DARK : LIGHT;

  async function setPreference(v: ThemePreference) {
    setPreferenceState(v);
    await SecureStore.setItemAsync(KEY, v);
  }

  const value = useMemo(
    () => ({ preference, mode, colors, setPreference }),
    [preference, mode, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePrefs(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemePrefs must be used inside ThemeProvider");
  return ctx;
}
