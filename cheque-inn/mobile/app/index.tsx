import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/auth";
import { useThemePrefs } from "@/store/theme";

export default function Index() {
  const router = useRouter();
  const { user, isLoading, platformAdminWebOnly } = useAuth();
  const { colors } = useThemePrefs();

  useEffect(() => {
    if (isLoading) return;
    if (platformAdminWebOnly) {
      router.replace("/(auth)/platform-admin-web-only");
      return;
    }
    if (user) {
      router.replace("/home");
    } else {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading, platformAdminWebOnly, router]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.label, { color: colors.muted }]}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "500",
  },
});
