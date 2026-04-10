import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/store/auth";
import { getTodaySessions, getMySessionHistory } from "@/lib/api/attendance.api";
import { getMyLeave } from "@/lib/api/leave.api";
import { getMyEarningsSummary } from "@/lib/api/payroll.api";
import { getPolicy } from "@/lib/api/companyPolicy.api";
import { isApiError } from "@/types/api";
import { useThemePrefs } from "@/store/theme";
import { pressStyle } from "@/lib/pressFeedback";
import { MobileEarningsSection } from "@/components/earnings/MobileEarningsSection";
import { currentHourInBusinessZone, formatSessionClock } from "@/lib/formatDateTime";

function formatDuration(m: number | null): string {
  if (m === null || m < 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function leaveStatusKey(s: string): "pending" | "approved" | "rejected" | "other" {
  const u = (s ?? "").toUpperCase();
  if (u === "PENDING") return "pending";
  if (u === "APPROVED") return "approved";
  if (u === "REJECTED") return "rejected";
  return "other";
}

/** Local time: morning 5–11:59, afternoon 12–16:59, evening 17+. */
function greetingPhrase(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17) return "Good evening";
  return "Hello";
}

function displayFirstName(firstName: string, lastName: string): string {
  const f = firstName.trim();
  if (f) return f;
  const l = lastName.trim();
  if (l) return l;
  return "";
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { colors } = useThemePrefs();
  const payrollEnabled = user != null && user.payrollEnabled !== false;

  const todayQuery = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => {
      const res = await getTodaySessions();
      if (res.success === false) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["attendance", "history", "home-preview"],
    queryFn: async () => {
      const res = await getMySessionHistory({ page: 1, limit: 5 });
      if (res.success === false) throw new Error(res.error);
      return res.data?.rows ?? [];
    },
  });

  const leaveQuery = useQuery({
    queryKey: ["leave", "my"],
    queryFn: async () => {
      const res = await getMyLeave();
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
    historyQuery.isRefetching ||
    leaveQuery.isRefetching ||
    (payrollEnabled && earningsQuery.isRefetching) ||
    policyQuery.isRefetching;

  const onRefresh = useCallback(async () => {
    await refreshUser();
    queryClient.invalidateQueries({ queryKey: ["attendance", "today"] });
    queryClient.invalidateQueries({ queryKey: ["attendance", "history", "home-preview"] });
    queryClient.invalidateQueries({ queryKey: ["leave", "my"] });
    if (payrollEnabled) {
      queryClient.invalidateQueries({ queryKey: ["payroll", "earnings", "me"] });
    }
    queryClient.invalidateQueries({ queryKey: ["company-policy"] });
  }, [queryClient, refreshUser, payrollEnabled]);

  const sessions = todayQuery.data ?? [];
  const activeSession = useMemo(
    () => sessions.find((s) => (s.status ?? "").toUpperCase() === "ACTIVE"),
    [sessions]
  );

  const lastCompleted = useMemo(() => {
    const rows = historyQuery.data ?? [];
    return rows.find((r) => (r.status ?? "").toUpperCase() === "COMPLETED") ?? rows[0];
  }, [historyQuery.data]);

  const leaveCounts = useMemo(() => {
    const list = leaveQuery.data ?? [];
    return list.reduce(
      (acc, r) => {
        const k = leaveStatusKey(r.status);
        if (k === "pending") acc.pending += 1;
        else if (k === "approved") acc.approved += 1;
        else if (k === "rejected") acc.rejected += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );
  }, [leaveQuery.data]);

  const loadingInitial =
    (todayQuery.isLoading && !todayQuery.data) ||
    (historyQuery.isLoading && !historyQuery.data) ||
    (leaveQuery.isLoading && !leaveQuery.data) ||
    (payrollEnabled && earningsQuery.isLoading && earningsQuery.data === undefined);

  const bizTz = user?.businessTimeZone ?? "UTC";
  const hour = currentHourInBusinessZone(new Date(), bizTz);
  const greeting = greetingPhrase(hour);
  const firstNameOrEmpty = user
    ? displayFirstName(user.firstName, user.lastName)
    : "";
  const who = firstNameOrEmpty || "there";

  const companyBranchLine = useMemo(() => {
    if (!user?.companyName) return null;
    if (user.branchName) return `${user.companyName} — ${user.branchName}`;
    return user.companyName;
  }, [user?.companyName, user?.branchName]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}
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
      <View style={styles.headerBlock}>
        <Text style={[styles.greetingMain, { color: colors.text }]}>
          {greeting}, {who} 👋
        </Text>
        {companyBranchLine ? (
          <Text style={[styles.greetingSub, { color: colors.muted }]}>{companyBranchLine}</Text>
        ) : null}
      </View>

      {loadingInitial ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.muted, { color: colors.muted }]}>Loading your dashboard…</Text>
        </View>
      ) : null}

      {/* Check-in status — first on Home so operational state leads */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>Attendance</Text>
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
        {activeSession ? (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statusTitle, { color: colors.text }]}>Clocked in</Text>
            </View>
            <Text style={[styles.statusDetail, { color: colors.muted }]}>
              Since {formatSessionClock(activeSession.check_in ?? null, bizTz)}
            </Text>
            <Text style={[styles.statusHint, { color: colors.muted }]}>Remember to check out when you leave.</Text>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: colors.muted }]} />
              <Text style={[styles.statusTitle, { color: colors.text }]}>Not clocked in</Text>
            </View>
            <Text style={[styles.statusDetail, { color: colors.muted }]}>
              Scan the branch QR at your attendance site to start your session.
            </Text>
          </>
        )}
      </View>

      {/* Last session */}
      <Text style={[styles.sectionLabel, styles.mt, { color: colors.muted }]}>Last session</Text>
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
        {!lastCompleted ? (
          <Text style={[styles.muted, { color: colors.muted }]}>No past sessions yet.</Text>
        ) : (
          <>
            <View style={styles.rowBetween}>
              <Text style={[styles.metaLabel, { color: colors.muted }]}>Status</Text>
              <View
                style={[
                  styles.badge,
                  (lastCompleted.status ?? "").toUpperCase() === "COMPLETED"
                    ? { backgroundColor: colors.toneSuccessBg }
                    : { backgroundColor: colors.toneNeutralBg },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color:
                      (lastCompleted.status ?? "").toUpperCase() === "COMPLETED"
                        ? colors.toneSuccessText
                        : colors.toneNeutralText,
                  }}
                >
                  {(lastCompleted.status ?? "").toUpperCase() === "COMPLETED"
                    ? "Completed"
                    : lastCompleted.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.sessionLine, { color: colors.text }]}>
              In: {formatSessionClock(lastCompleted.check_in, bizTz)}
            </Text>
            <Text style={[styles.sessionLine, { color: colors.text }]}>
              Out: {formatSessionClock(lastCompleted.check_out, bizTz)}
            </Text>
            <Text style={[styles.sessionMeta, { color: colors.muted }]}>
              {[lastCompleted.branch_name, lastCompleted.department_name].filter(Boolean).join(" · ") ||
                "—"}{" "}
              · {formatDuration(lastCompleted.duration_minutes)}
            </Text>
          </>
        )}
      </View>

      {payrollEnabled ? (
        <>
          <Text style={[styles.sectionLabel, styles.mt, { color: colors.muted }]}>Earnings snapshot</Text>
          <Pressable
            onPress={() => router.push("/attendance")}
            style={({ pressed }) => [pressed ? { opacity: 0.92 } : null]}
            accessibilityRole="button"
            accessibilityLabel="Open Attendance for full earnings"
          >
            <MobileEarningsSection
              colors={colors}
              data={earningsQuery.data}
              isError={earningsQuery.isError}
              isLoading={earningsQuery.isLoading && earningsQuery.data === undefined}
              variant="compact"
              currencyCode={policyQuery.data?.currency_code ?? "GHS"}
            />
          </Pressable>
        </>
      ) : null}

      {/* Leave summary */}
      <Text style={[styles.sectionLabel, styles.mt, { color: colors.muted }]}>Leave</Text>
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
        <View style={styles.leaveCounts}>
          <View style={[styles.countPill, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.countNum, { color: colors.warning }]}>{leaveCounts.pending}</Text>
            <Text style={[styles.countLbl, { color: colors.muted }]}>Pending</Text>
          </View>
          <View style={[styles.countPill, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.countNum, { color: colors.success }]}>{leaveCounts.approved}</Text>
            <Text style={[styles.countLbl, { color: colors.muted }]}>Approved</Text>
          </View>
          <View style={[styles.countPill, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.countNum, { color: colors.danger }]}>{leaveCounts.rejected}</Text>
            <Text style={[styles.countLbl, { color: colors.muted }]}>Rejected</Text>
          </View>
        </View>
        <Text style={[styles.mutedSmall, { color: colors.muted }]}>
          {(leaveQuery.data?.length ?? 0) === 0
            ? "No leave requests on file."
            : `${leaveQuery.data?.length} total request(s).`}
        </Text>
      </View>

      <Text style={[styles.sectionLabel, styles.mt, { color: colors.muted }]}>Quick actions</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.primary },
            pressStyle({ pressed }, { opacity: 0.9, scale: 0.99 }),
          ]}
          onPress={() => router.push("/attendance/scan")}
        >
          <Ionicons name="qr-code-outline" size={22} color={colors.onPrimary} />
          <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>Scan QR</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtnSecondary,
            {
              backgroundColor: colors.surface,
              borderColor: colors.secondaryBorder,
            },
            pressStyle({ pressed }, { opacity: 0.92, scale: 0.995 }),
          ]}
          onPress={() => router.push("/leave")}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <Text style={[styles.actionBtnTextSecondary, { color: colors.primary }]}>Request leave</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  headerBlock: { marginBottom: 22 },
  greetingMain: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
  },
  greetingSub: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "500",
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  muted: { fontSize: 14 },
  mutedSmall: { fontSize: 13, marginTop: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  mt: { marginTop: 22 },
  card: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 18, fontWeight: "700" },
  statusDetail: { fontSize: 15, marginTop: 8 },
  statusHint: { fontSize: 13, marginTop: 6 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metaLabel: { fontSize: 13, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sessionLine: { fontSize: 15, marginTop: 4 },
  sessionMeta: { fontSize: 13, marginTop: 10 },
  leaveCounts: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  countPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  countNum: { fontSize: 22, fontWeight: "800" },
  countLbl: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  actions: { gap: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700" },
  actionBtnTextSecondary: { fontSize: 16, fontWeight: "700" },
});
