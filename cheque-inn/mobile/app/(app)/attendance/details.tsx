import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useThemePrefs } from "@/store/theme";

export default function AttendanceDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { colors } = useThemePrefs();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Session details</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>
        {params.id ? `Session ${params.id}` : "No session selected."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: "800" },
  muted: { fontSize: 14, marginTop: 8, lineHeight: 20 },
});
