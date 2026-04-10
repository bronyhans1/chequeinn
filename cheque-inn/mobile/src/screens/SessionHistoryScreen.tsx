import { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  getMySessionHistory,
  type SessionHistoryItem,
} from "@/lib/api/attendance.api";
import { useThemePrefs } from "@/store/theme";
import { sessionStatusBadge } from "@/lib/statusTokens";
import { useAuth } from "@/store/auth";
import { formatSessionClock, formatSessionDay } from "@/lib/formatDateTime";

function formatDuration(m: number | null): string {
  if (m === null || m < 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

/** List + fetch only — page title lives in `app/(app)/history/index.tsx`. */
export function SessionHistoryList() {
  const { colors } = useThemePrefs();
  const { user } = useAuth();
  const bizTz = user?.businessTimeZone ?? "UTC";
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["attendance", "history", "my"],
    queryFn: async () => {
      const res = await getMySessionHistory({ page: 1, limit: 50 });
      if (res.success === false) throw new Error(res.error);
      return res.data;
    },
  });

  const rows = data?.rows ?? [];

  const sections = useMemo(() => {
    const map = new Map<string, SessionHistoryItem[]>();
    for (const r of rows) {
      const key = r.check_in ? r.check_in.slice(0, 10) : "—";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const flatData = useMemo(() => {
    const out: Array<
      { type: "header"; date: string } | { type: "row"; item: SessionHistoryItem }
    > = [];
    for (const [dateKey, items] of sections) {
      const sample = items[0]?.check_in ?? null;
      out.push({
        type: "header",
        date: dateKey === "—" ? "Unknown" : formatSessionDay(sample, bizTz),
      });
      for (const item of items) {
        out.push({ type: "row", item });
      }
    }
    return out;
  }, [sections, bizTz]);

  if (isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.muted, { color: colors.muted }]}>Loading your sessions…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.error, { color: colors.danger }]}>
          {error instanceof Error ? error.message : "Failed to load"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {rows.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No sessions yet</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            When you clock in and out, your history will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={flatData}
          keyExtractor={(entry, index) =>
            entry.type === "header" ? `h-${entry.date}-${index}` : `r-${entry.item.id}`
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item: entry }) => {
            if (entry.type === "header") {
              return (
                <Text style={[styles.sectionHeader, { color: colors.toneNeutralText }]}>
                  {entry.date}
                </Text>
              );
            }
            const item = entry.item;
            const st = sessionStatusBadge(colors, item.status ?? "");
            return (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowTop}>
                  <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <Text style={[styles.office, { color: colors.muted }]}>
                    {[item.branch_name, item.department_name].filter(Boolean).join(" · ") || "—"}
                  </Text>
                </View>
                <Text style={[styles.rowLine, { color: colors.text }]}>
                  In: {formatSessionClock(item.check_in, bizTz)}
                </Text>
                <Text style={[styles.rowLine, { color: colors.text }]}>
                  Out: {formatSessionClock(item.check_out, bizTz)}
                </Text>
                <Text style={[styles.duration, { color: colors.muted }]}>
                  Duration: {formatDuration(item.duration_minutes)}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  muted: { fontSize: 14 },
  error: { textAlign: "center", fontSize: 15, fontWeight: "600" },
  emptyBox: {
    marginTop: 0,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 12, fontWeight: "800" },
  office: { fontSize: 13, flex: 1, textAlign: "right" },
  rowLine: { fontSize: 15, marginTop: 2 },
  duration: { fontSize: 13, marginTop: 8 },
});
