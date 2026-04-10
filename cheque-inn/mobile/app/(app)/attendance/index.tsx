import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getTodaySessions } from "@/lib/api/attendance.api";
import { getMyEarningsSummary } from "@/lib/api/payroll.api";
import { getPolicy } from "@/lib/api/companyPolicy.api";
import { isApiError } from "@/types/api";
import { useThemePrefs } from "@/store/theme";
import { useAuth } from "@/store/auth";
import { pressStyle } from "@/lib/pressFeedback";
import { MobileEarningsSection } from "@/components/earnings/MobileEarningsSection";
import { formatSessionClock } from "@/lib/formatDateTime";

export default function AttendanceHubScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemePrefs();
  const { user } = useAuth();
  const payrollEnabled = user != null && user.payrollEnabled !== false;
  const bizTz = user?.businessTimeZone ?? "UTC";

  const todayQuery = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => {
      const res = await getTodaySessions();
      if (res.success === false) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const earningsQuery = useQuery({
    queryKey: ["payroll", "earnings", "me"],
    enabled: payrollEnabled,
    queryFn: async () => {
      const res = await getMyEarningsSummary();
      if (isApiError(res)) throw new Error(res.error);
      return res.data ?? null;
    },
  });

  const policyQuery = useQuery({
    queryKey: ["company-policy"],
    queryFn: async () => {
      const res = await getPolicy();
      if (isApiError(res)) throw new Error(res.error);
      return res.data;
    },
  });

  const refreshing =
    todayQuery.isRefetching ||
    (payrollEnabled && earningsQuery.isRefetching) ||
    policyQuery.isRefetching;

  const onRefresh = useCallback(async () => {
    const tasks = [
      queryClient.invalidateQueries({ queryKey: ["attendance", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["company-policy"] }),
    ];
    if (payrollEnabled) {
      tasks.push(queryClient.invalidateQueries({ queryKey: ["payroll", "earnings", "me"] }));
    }
    await Promise.all(tasks);
  }, [queryClient, payrollEnabled]);

  const sessions = todayQuery.data ?? [];
  const activeSession = useMemo(
    () => sessions.find((s) => (s.status ?? "").toUpperCase() === "ACTIVE"),
    [sessions]
  );
  const hasActiveSession = Boolean(activeSession);

  const loadingToday = todayQuery.isLoading && !todayQuery.data;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Attendance</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
          Scan the branch QR code at your attendance site to check in or check out.
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.muted }]}>Today's attendance</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {loadingToday ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { color: colors.muted }]}>Loading status…</Text>
          </View>
        ) : hasActiveSession && activeSession ? (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statusTitle, { color: colors.text }]}>Clocked in</Text>
            </View>
            <Text style={[styles.statusDetail, { color: colors.muted }]}>
              Since {formatSessionClock(activeSession.check_in ?? null, bizTz)}
            </Text>
            <Text style={[styles.statusHint, { color: colors.muted }]}>
              Check out when you leave, or scan again at the branch QR.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: colors.muted }]} />
              <Text style={[styles.statusTitle, { color: colors.text }]}>Not clocked in</Text>
            </View>
            <Text style={[styles.statusDetail, { color: colors.muted }]}>
              Scan the branch QR code at your attendance site to start your session.
            </Text>
          </>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary },
          pressStyle({ pressed }, { opacity: 0.9, scale: 0.98 }),
        ]}
        onPress={() =>
          hasActiveSession ? router.push("/attendance/check-out") : router.push("/attendance/scan")
        }
      >
        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
          {hasActiveSession ? "Check out" : "Scan to check in"}
        </Text>
      </Pressable>

      {payrollEnabled ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionSpacer, { color: colors.muted }]}>
            Live earnings
          </Text>
          <MobileEarningsSection
            colors={colors}
            data={earningsQuery.data}
            isError={earningsQuery.isError}
            isLoading={earningsQuery.isLoading && earningsQuery.data === undefined}
            variant="full"
            currencyCode={policyQuery.data?.currency_code ?? "GHS"}
          />
        </>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.historyLink,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
          pressStyle({ pressed }, { opacity: 0.92 }),
        ]}
        onPress={() => router.push("/history")}
      >
        <Ionicons name="list-outline" size={20} color={colors.primary} />
        <View style={styles.historyLinkText}>
          <Text style={[styles.historyLinkTitle, { color: colors.text }]}>Full session history</Text>
          <Text style={[styles.historyLinkHint, { color: colors.muted }]}>
            Opens your History tab — all past sessions in one place
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  sectionSpacer: { marginTop: 24 },
  card: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  muted: { fontSize: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 18, fontWeight: "700" },
  statusDetail: { fontSize: 15, marginTop: 8 },
  statusHint: { fontSize: 13, marginTop: 6 },
  primaryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyLinkText: { flex: 1, minWidth: 0 },
  historyLinkTitle: { fontSize: 15, fontWeight: "700" },
  historyLinkHint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
