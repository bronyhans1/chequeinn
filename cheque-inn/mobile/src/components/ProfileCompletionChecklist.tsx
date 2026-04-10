import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, LayoutAnimation } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemePalette } from "@/store/theme";

// LayoutAnimation on Android used to require setLayoutAnimationEnabledExperimental; on React Native's
// New Architecture that call is a no-op and only produces a console warning — animations still
// degrade gracefully without it.

export type ChecklistItem = {
  key: string;
  label: string;
  required: boolean;
  done: boolean;
};

interface Props {
  colors: ThemePalette;
  items: ChecklistItem[];
  title?: string;
  subtitle?: string;
}

export function ProfileCompletionChecklist({
  colors,
  items,
  title = "Your profile",
  subtitle = "A few quick steps help your team know you better.",
}: Props) {
  const doneCount = useMemo(() => items.filter((i) => i.done).length, [items]);
  const total = items.length;
  const progress = total > 0 ? doneCount / total : 0;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [doneCount, total]);

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>

      <View style={[styles.barBg, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: colors.muted }]}>
        {doneCount} of {total} complete
      </Text>

      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.key} style={styles.row}>
            <Ionicons
              name={item.done ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={item.done ? colors.success : colors.muted}
            />
            <View style={styles.rowText}>
              <Text style={[styles.itemLabel, { color: colors.text }]}>{item.label}</Text>
              {item.required ? (
                <Text style={[styles.badge, { color: colors.primary }]}>Required</Text>
              ) : (
                <Text style={[styles.badgeSoft, { color: colors.muted }]}>Recommended</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  barBg: {
    height: 8,
    borderRadius: 999,
    marginTop: 14,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressLabel: { fontSize: 12, marginTop: 8, fontWeight: "600" },
  list: { marginTop: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rowText: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  itemLabel: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  badge: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  badgeSoft: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
});
