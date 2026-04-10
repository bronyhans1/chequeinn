import { View, Text, StyleSheet } from "react-native";
import { useThemePrefs } from "@/store/theme";

export default function TeamPlaceholderScreen() {
  const { colors } = useThemePrefs();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Team</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>
        Team directory and related tools will appear here in a future update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "800" },
  muted: { fontSize: 14, marginTop: 8, lineHeight: 20 },
});
