import { View, Text, StyleSheet } from "react-native";
import { useThemePrefs } from "@/store/theme";
import { SessionHistoryList } from "@/screens/SessionHistoryScreen";

/** History tab: in-page title + list below `AppTopBar` (no native stack header on this screen). */
export default function HistoryScreen() {
  const { colors } = useThemePrefs();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Your attendance sessions. Pull to refresh.
        </Text>
      </View>
      <SessionHistoryList />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
});
