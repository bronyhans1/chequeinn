import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useThemePrefs } from "@/store/theme";

/**
 * Optional verification / camera capture step.
 * Backend does not currently require or accept photo verification for attendance.
 * Placeholder for future facial or photo verification.
 */
export default function VerifyScreen() {
  const params = useLocalSearchParams<{ officeName?: string }>();
  const { colors } = useThemePrefs();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Verify location</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {params.officeName ? `Office: ${params.officeName}` : "Office verified."}
      </Text>
      <Text style={[styles.muted, { color: colors.muted }]}>
        Optional verification step. Proceed to check in from the previous screen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 16, marginTop: 8, lineHeight: 22 },
  muted: { fontSize: 14, marginTop: 16, lineHeight: 20 },
});
