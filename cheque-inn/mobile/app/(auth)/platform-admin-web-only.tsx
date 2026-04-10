import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/auth";
import { useThemePrefs } from "@/store/theme";
import { pressStyle } from "@/lib/pressFeedback";

/**
 * Shown when the signed-in account is PLATFORM_ADMIN.
 * Mobile is for company users only; platform administration is web-only.
 */
export default function PlatformAdminWebOnlyScreen() {
  const router = useRouter();
  const { dismissPlatformAdminNotice } = useAuth();
  const { colors } = useThemePrefs();

  function handleContinue() {
    dismissPlatformAdminNotice();
    router.replace("/(auth)/login");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Web app required</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          This mobile app is for employees and company teams. Platform administration (managing
          companies and system-wide settings) is only available in the Cheque-Inn web app.
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Please open Cheque-Inn in your browser to sign in as a platform administrator.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressStyle({ pressed }, { opacity: 0.9, scale: 0.99 }),
          ]}
          onPress={handleContinue}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Back to sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  button: {
    marginTop: 20,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
