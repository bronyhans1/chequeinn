import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyLeave, requestLeave } from "@/lib/api/leave.api";
import { useThemePrefs } from "@/store/theme";
import { leaveStatusBadge } from "@/lib/statusTokens";
import { pressStyle } from "@/lib/pressFeedback";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual" },
  { value: "sick", label: "Sick" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
] as const;

export default function LeaveScreen() {
  const { colors } = useThemePrefs();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<string>("annual");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leave", "my"],
    queryFn: async () => {
      const res = await getMyLeave();
      if (res.success === false) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const start = startDate.trim();
      const end = endDate.trim();
      if (!start || !end) {
        throw new Error("Start and end dates are required (YYYY-MM-DD).");
      }
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      if (!iso.test(start) || !iso.test(end)) {
        throw new Error("Use date format YYYY-MM-DD.");
      }
      const res = await requestLeave({
        start_date: start,
        end_date: end,
        leave_type: leaveType,
        reason: reason.trim() || undefined,
      });
      if (res.success === false) throw new Error(res.error ?? "Request failed");
      return res.data;
    },
    onSuccess: () => {
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["leave", "my"] });
    },
    onError: (e: Error) => {
      setFormError(e.message);
    },
  });

  const list = data ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Leave</Text>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Request leave</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {formError ? (
            <View
              style={[
                styles.formErrorBox,
                { backgroundColor: colors.surfaceDanger, borderColor: colors.danger },
              ]}
            >
              <Text style={[styles.formError, { color: colors.danger }]}>{formError}</Text>
            </View>
          ) : null}
          <Text style={[styles.inputLabel, { color: colors.muted }]}>Start (YYYY-MM-DD)</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2025-04-01"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.text,
              },
            ]}
          />
          <Text style={[styles.inputLabel, { color: colors.muted }]}>End (YYYY-MM-DD)</Text>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2025-04-03"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.text,
              },
            ]}
          />
          <Text style={[styles.inputLabel, { color: colors.muted }]}>Type</Text>
          <View style={styles.typeRow}>
            {LEAVE_TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setLeaveType(t.value)}
                style={({ pressed }) => [
                  styles.typeChip,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                  },
                  leaveType === t.value && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                  pressStyle({ pressed }, { opacity: 0.92 }),
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    { color: colors.text },
                    leaveType === t.value && { color: colors.onPrimary, fontWeight: "700" },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.inputLabel, { color: colors.muted }]}>Reason (optional)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Optional note"
            placeholderTextColor={colors.muted}
            multiline
            style={[
              styles.input,
              styles.textArea,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary },
              mutation.isPending && styles.submitBtnDisabled,
              pressStyle({ pressed: pressed || mutation.isPending }, { opacity: 0.9, scale: 0.99 }),
            ]}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>Submit request</Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, styles.mt, { color: colors.muted }]}>My requests</Text>
        {isLoading ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { color: colors.muted }]}>Loading…</Text>
          </View>
        ) : isError ? (
          <Text style={[styles.formError, { color: colors.danger }]}>
            {error instanceof Error ? error.message : "Failed to load"}
          </Text>
        ) : list.length === 0 ? (
          <Text style={[styles.muted, { color: colors.muted }]}>No leave requests yet.</Text>
        ) : (
          list.map((item) => {
            const badge = leaveStatusBadge(colors, item.status);
            return (
              <View key={item.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.rowDates, { color: colors.text }]}>
                    {item.start_date} → {item.end_date}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
                <Text style={[styles.rowMeta, { color: colors.muted }]}>
                  {item.leave_type} · {item.total_days} day(s)
                </Text>
                {item.reason ? (
                  <Text style={[styles.rowReason, { color: colors.toneNeutralText }]}>{item.reason}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  mt: { marginTop: 24 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  formErrorBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontWeight: "500" },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    minHeight: 50,
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { fontSize: 16, fontWeight: "700" },
  formError: { fontSize: 14, marginBottom: 8, fontWeight: "600" },
  muted: { fontSize: 14 },
  loadingInline: { flexDirection: "row", alignItems: "center", gap: 10 },
  row: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowDates: { fontWeight: "700", flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  rowMeta: { fontSize: 13, marginTop: 6 },
  rowReason: { fontSize: 14, marginTop: 6 },
});
