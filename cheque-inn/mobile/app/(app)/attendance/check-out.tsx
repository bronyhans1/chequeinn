import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { clockOut } from "@/lib/api/attendance.api";
import { useThemePrefs } from "@/store/theme";
import { useAuth } from "@/store/auth";
import { pressStyle } from "@/lib/pressFeedback";
import { SuccessToast } from "@/components/SuccessToast";
import { formatBusinessTimeOnly } from "@/lib/formatDateTime";

export default function CheckOutScreen() {
  const router = useRouter();
  const { colors } = useThemePrefs();
  const { user } = useAuth();
  const bizTz = user?.businessTimeZone ?? "UTC";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successSubtitle, setSuccessSubtitle] = useState<string | null>(null);

  async function handleCheckOut() {
    setError(null);
    setLocationError(null);
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const res = await clockOut({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (res.success === false) {
        setError(res.error ?? "Check-out failed");
        return;
      }
      const payrollNote =
        res.warnings && res.warnings.length > 0
          ? `\n\n${res.warnings.map((w) => w.message).join("\n\n")}`
          : "";
      setSuccessSubtitle(`Recorded at ${formatBusinessTimeOnly(new Date(), bizTz)}${payrollNote}`);
      setSuccessVisible(true);
      setTimeout(() => {
        router.replace("/attendance");
      }, 900);
    } catch (e) {
      if (e instanceof Error && e.message.includes("location")) {
        setLocationError("Location permission required to check out.");
      } else {
        setError(e instanceof Error ? e.message : "Check-out failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SuccessToast
        visible={successVisible}
        message="Checked out successfully"
        subtitle={successSubtitle ?? undefined}
        onHidden={() => setSuccessVisible(false)}
      />
      <Text style={[styles.title, { color: colors.text }]}>Check out</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Your location will be verified before clocking out.
      </Text>
      {(error || locationError) ? (
        <View style={[styles.errorBox, { backgroundColor: colors.surfaceDanger, borderColor: colors.danger }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error ?? locationError}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary },
          loading && styles.buttonDisabled,
          pressStyle({ pressed: pressed || loading }, { opacity: 0.88, scale: 0.99 }),
        ]}
        onPress={handleCheckOut}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Confirm check out</Text>
        )}
      </Pressable>
      <Pressable style={({ pressed }) => [styles.back, pressStyle({ pressed })]} onPress={() => router.back()} disabled={loading}>
        <Text style={[styles.backText, { color: colors.muted }]}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
  },
  errorText: { fontWeight: "600", fontSize: 14 },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
    minHeight: 54,
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  back: { alignItems: "center", marginTop: 16, paddingVertical: 8 },
  backText: { fontWeight: "600", fontSize: 16 },
});
