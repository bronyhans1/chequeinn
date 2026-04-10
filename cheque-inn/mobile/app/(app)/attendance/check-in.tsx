import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { clockIn } from "@/lib/api/attendance.api";
import { useThemePrefs } from "@/store/theme";
import { useAuth } from "@/store/auth";
import { pressStyle } from "@/lib/pressFeedback";
import { SuccessToast } from "@/components/SuccessToast";
import { formatBusinessTimeOnly } from "@/lib/formatDateTime";

export default function CheckInScreen() {
  const router = useRouter();
  const { colors } = useThemePrefs();
  const { user } = useAuth();
  const bizTz = user?.businessTimeZone ?? "UTC";
  const params = useLocalSearchParams<{
    branchId?: string;
    branchName?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successSubtitle, setSuccessSubtitle] = useState<string | null>(null);

  async function handleCheckIn() {
    setError(null);
    const branchId = params.branchId?.trim();
    if (!branchId) {
      setError("Missing office. Scan the office QR code again.");
      return;
    }
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission is required to check in.");
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const res = await clockIn({
        branch_id: branchId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (res.success === false) {
        setError(res.error ?? "Check-in failed");
        return;
      }
      setSuccessSubtitle(`Recorded at ${formatBusinessTimeOnly(new Date(), bizTz)}`);
      setSuccessVisible(true);
      setTimeout(() => {
        router.replace("/attendance");
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SuccessToast
        visible={successVisible}
        message="Checked in successfully"
        subtitle={successSubtitle ?? undefined}
        onHidden={() => setSuccessVisible(false)}
      />
      <Text style={[styles.title, { color: colors.text }]}>Check in</Text>
      {params.branchName ? (
        <Text style={[styles.office, { color: colors.muted }]}>{params.branchName}</Text>
      ) : null}
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.surfaceDanger, borderColor: colors.danger }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary },
          loading && styles.buttonDisabled,
          pressStyle({ pressed: pressed || loading }, { opacity: 0.88, scale: 0.99 }),
        ]}
        onPress={handleCheckIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Confirm check in</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.back, pressStyle({ pressed })]}
        onPress={() => router.back()}
        disabled={loading}
      >
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
  office: { fontSize: 16, marginTop: 8 },
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
