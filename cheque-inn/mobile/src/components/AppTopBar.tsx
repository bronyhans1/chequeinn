import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemePrefs } from "@/store/theme";
import { useRouter } from "expo-router";

export function AppTopBar({ feature }: { feature: string }) {
  const { colors } = useThemePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === "android" ? 8 : 0);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: topPad,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.rowSides}>
          <View style={styles.side}>
            <Text style={[styles.feature, { color: colors.muted }]} numberOfLines={1}>
              {feature}
            </Text>
          </View>
          <View style={[styles.side, styles.sideRight]}>
            <Pressable
              onPress={() => router.push("/notifications")}
              android_ripple={{ color: `${colors.primary}33`, borderless: true }}
              style={({ pressed }) => [
                styles.bellBtn,
                {
                  backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                },
                ...(pressed && Platform.OS === "ios" ? [{ opacity: 0.88 } as const] : []),
              ]}
              accessibilityLabel="Notifications"
              hitSlop={12}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <View style={styles.centerTitleAbs} pointerEvents="box-none">
          <Text style={[styles.brand, { color: colors.text }]} numberOfLines={1}>
            Cheque-Inn
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  inner: {
    position: "relative",
    minHeight: 52,
    justifyContent: "center",
  },
  rowSides: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  side: {
    flex: 1,
    minWidth: 0,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  centerTitleAbs: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  feature: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  brand: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  bellBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
});
