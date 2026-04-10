import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemePrefs } from "@/store/theme";
import { pressStyle } from "@/lib/pressFeedback";

/**
 * Future-ready: no fake notification list — clear expectations and a path back.
 */
export default function NotificationsScreen() {
  const { colors } = useThemePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressStyle({ pressed }, { opacity: 0.75, scale: 0.98 })]}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="notifications-outline" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          When announcements, attendance alerts, and leave updates are ready, they will appear here. You are
          not missing anything yet.
        </Text>
        <View style={[styles.pill, { borderColor: colors.border }]}>
          <Ionicons name="construct-outline" size={16} color={colors.muted} />
          <Text style={[styles.pillText, { color: colors.muted }]}>Feature in roadmap</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 17, fontWeight: "600" },
  hero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  pill: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
});
