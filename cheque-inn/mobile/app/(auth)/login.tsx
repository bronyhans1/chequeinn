import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/auth";
import { createClient } from "@supabase/supabase-js";
import { ENV } from "@/lib/env";
import { useThemePrefs } from "@/store/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { BRAND, LEGAL_LINKS } from "@/lib/branding";
import { Image } from "react-native";

const LOGIN_BG_LIGHT_PNG = require("../../assets/brand/login-bg-light.png");
const LOGIN_BG_DARK_PNG = require("../../assets/brand/login-bg-dark.png");

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, isLoading, platformAdminWebOnly, accountAccessBlocked, clearAccountAccessBlocked } =
    useAuth();
  const { colors, mode } = useThemePrefs();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const supabase =
    ENV.EXPO_PUBLIC_SUPABASE_URL && ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY
      ? createClient(ENV.EXPO_PUBLIC_SUPABASE_URL, ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY)
      : null;

  /** Never navigate during render — only after commit (avoids React concurrent warning). */
  useEffect(() => {
    if (isLoading) return;
    if (platformAdminWebOnly) {
      router.replace("/(auth)/platform-admin-web-only");
      return;
    }
    if (user) {
      router.replace("/home");
    }
  }, [user, isLoading, platformAdminWebOnly, router]);

  const artOpacity = mode === "dark" ? 0.12 : 0.2;
  const bgSource = mode === "dark" ? LOGIN_BG_DARK_PNG : LOGIN_BG_LIGHT_PNG;
  const year = new Date().getFullYear();

  function LegalFooter() {
    return (
      <View style={styles.legalFooter}>
        <Text style={[styles.legalText, { color: colors.muted }]}>Cheque-Inn Mobile © {year}</Text>
        <Text style={[styles.legalSentence, { color: colors.muted }]}>
          By continuing, you agree to Cheque-Inn’s{" "}
          <Text
            style={[styles.legalSentenceLink, { color: colors.primary }]}
            onPress={() => Linking.openURL(LEGAL_LINKS.terms)}
            accessibilityRole="link"
          >
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            style={[styles.legalSentenceLink, { color: colors.primary }]}
            onPress={() => Linking.openURL(LEGAL_LINKS.privacy)}
            accessibilityRole="link"
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        <View style={[styles.artLayer, { opacity: artOpacity }]} pointerEvents="none">
          <Image
            source={bgSource}
            style={styles.artImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            importantForAccessibility="no"
          />
        </View>
        <View style={styles.centeredOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <SafeAreaView pointerEvents="none" style={styles.safeAreaFooterOnly}>
          <LegalFooter />
        </SafeAreaView>
      </View>
    );
  }

  if (platformAdminWebOnly) {
    return (
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        <View style={[styles.artLayer, { opacity: artOpacity }]} pointerEvents="none">
          <Image
            source={bgSource}
            style={styles.artImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            importantForAccessibility="no"
          />
        </View>
        <View style={styles.centeredOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <SafeAreaView pointerEvents="none" style={styles.safeAreaFooterOnly}>
          <LegalFooter />
        </SafeAreaView>
      </View>
    );
  }

  if (user) {
    return null;
  }

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    clearAccountAccessBlocked();
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.ok && !result.accessBlocked) {
      setError(result.error ?? "Login failed");
    }
    /** Success: redirect runs in useEffect when `user` updates */
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);
    const normalized = email.trim();
    if (!normalized) {
      setError("Enter your email first.");
      return;
    }
    if (!supabase) {
      setError("Password reset is unavailable: Supabase not configured.");
      return;
    }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(normalized);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setInfo("Reset link sent. Please check your email.");
  }

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: colors.background }]}>
      <View style={[styles.artLayer, { opacity: artOpacity }]} pointerEvents="none">
        <Image
          source={bgSource}
          style={styles.artImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          importantForAccessibility="no"
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.safeArea}
      >
        <View style={styles.main}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={styles.logoWrap}>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel={`${BRAND.appName} logo`}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Sign in to continue</Text>

            {(accountAccessBlocked?.message || error) ? (
              <View style={[styles.errorBox, { backgroundColor: colors.surfaceDanger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {accountAccessBlocked?.message ?? error}
                </Text>
              </View>
            ) : null}
            {info ? (
              <View style={[styles.infoBox, { backgroundColor: colors.toneSuccessBg, borderColor: colors.border }]}>
                <Text style={[styles.infoText, { color: colors.toneSuccessText }]}>{info}</Text>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <View style={styles.passwordWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted },
                ]}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.inlineRow}>
              <View />
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={[styles.link, { color: colors.primary }]}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !email.trim() || !password}
              activeOpacity={0.9}
            >
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                {submitting ? "Signing in…" : "Sign in"}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.hint, { color: colors.muted }]}>
              Smarter Workforce. Seamless Management.
            </Text>

            <View style={styles.footerRow}>
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}`)}
                accessibilityRole="link"
              >
                <Text style={[styles.supportLink, { color: colors.primary }]}>Need help? Contact Us</Text>
              </TouchableOpacity>
              <Text style={[styles.version, { color: colors.muted }]}>
                v{Constants.expoConfig?.version ?? "0.0.0"}
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <LegalFooter />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  artLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  artImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
  },
  safeAreaFooterOnly: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  errorBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 44,
    marginBottom: 0,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 13,
  },
  inlineRow: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  link: {
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  supportLink: {
    fontSize: 12,
    fontWeight: "600",
  },
  version: {
    fontSize: 12,
    opacity: 0.7,
  },
  infoBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
  },
  legalFooter: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: "center",
  },
  legalText: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.86,
  },
  legalSentence: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    opacity: 0.9,
  },
  legalSentenceLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },
});
