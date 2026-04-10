import { View, Text, StyleSheet } from "react-native";
import type { ThemePalette } from "@/store/theme";
import type { EarningsSummary } from "@/lib/api/payroll.api";
import { formatCurrency, type CurrencyCode } from "@/lib/formatCurrency";

type Props = {
  colors: ThemePalette;
  data: EarningsSummary | null | undefined;
  isError: boolean;
  isLoading: boolean;
  variant: "full" | "compact";
  currencyCode: CurrencyCode | "GHS" | "USD";
};

/**
 * Shared live earnings UI: full detail on Attendance, compact snapshot on Home.
 */
export function MobileEarningsSection({ colors, data, isError, isLoading, variant, currencyCode }: Props) {
  if (variant === "compact") {
    return (
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
        <Text style={[styles.compactEyebrow, { color: colors.muted }]}>Earnings (company calendar)</Text>
        {isError ? (
          <Text style={[styles.muted, { color: colors.danger }]}>Could not load earnings.</Text>
        ) : isLoading && data == null ? (
          <Text style={[styles.muted, { color: colors.muted }]}>Loading…</Text>
        ) : data == null || data.rate_type === "none" ? (
          <Text style={[styles.compactMuted, { color: colors.muted }]}>
            No compensation profile yet. Open Attendance for details when your pay is assigned.
          </Text>
        ) : (
          <>
            {data.earnings_period_label ? (
              <Text style={[styles.compactHint, { color: colors.muted, marginBottom: 6 }]}>
                {data.earnings_period_label}
              </Text>
            ) : null}
            <View style={styles.compactRow}>
              <Text style={[styles.compactMain, { color: colors.text }]}>
                <Text style={[styles.compactLabel, { color: colors.muted }]}>
                  Day {data.calendar_today ?? "—"}{" "}
                </Text>
                {formatCurrency(data.today_earned, currencyCode)}
              </Text>
              <Text style={[styles.compactDot, { color: colors.muted }]}> · </Text>
              <Text style={[styles.compactMain, { color: colors.text }]}>
                <Text style={[styles.compactLabel, { color: colors.muted }]}>This month </Text>
                {formatCurrency(data.month_earned_total, currencyCode)}
              </Text>
            </View>
            {(data.month_late_deduction_total ?? 0) > 0 ? (
              <Text style={[styles.compactLateNote, { color: colors.muted }]}>
                Late MTD: −{formatCurrency(data.month_late_deduction_total ?? 0, currencyCode)}
              </Text>
            ) : null}
          </>
        )}
        <Text style={[styles.compactHint, { color: colors.muted }]}>
          Full breakdown and context on the Attendance tab.
        </Text>
      </View>
    );
  }

  return (
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
      {isError ? (
        <Text style={[styles.muted, { color: colors.danger }]}>Could not load earnings.</Text>
      ) : data == null ? (
        <Text style={[styles.muted, { color: colors.muted }]}>Loading…</Text>
      ) : data.rate_type === "none" ? (
        <Text style={[styles.muted, { color: colors.muted }]}>
          No compensation profile yet. Your employer will assign hourly or monthly pay to unlock earnings.
        </Text>
      ) : (
        <>
          {data.earnings_period_label ? (
            <Text style={[styles.mutedSmall, { color: colors.muted, marginTop: 0 }]}>
              {data.earnings_period_label}
            </Text>
          ) : null}
          <View style={styles.earningsGrid}>
            <View style={[styles.earningsStat, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.earningsStatLbl, { color: colors.muted }]}>
                Today · {data.calendar_today ?? "—"}
              </Text>
              <Text style={[styles.earningsStatVal, { color: colors.text }]}>
                {formatCurrency(data.today_earned, currencyCode)}
              </Text>
            </View>
            <View style={[styles.earningsStat, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.earningsStatLbl, { color: colors.muted }]}>This month</Text>
              <Text style={[styles.earningsStatVal, { color: colors.text }]}>
                {formatCurrency(data.month_earned_total, currencyCode)}
              </Text>
            </View>
          </View>
          {data.rate_type === "monthly" ? (
            <>
              <View style={styles.earningsGrid}>
                <View style={[styles.earningsStat, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.earningsStatLbl, { color: colors.muted }]}>Expected salary</Text>
                  <Text style={[styles.earningsStatVal, { color: colors.text }]}>
                    {data.expected_monthly_salary != null
                      ? formatCurrency(data.expected_monthly_salary, currencyCode)
                      : "—"}
                  </Text>
                </View>
                <View style={[styles.earningsStat, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.earningsStatLbl, { color: colors.muted }]}>Paid / unpaid days</Text>
                  <Text style={[styles.earningsStatVal, { color: colors.text }]}>
                    {data.paid_days} / {data.unpaid_days}
                  </Text>
                </View>
              </View>
              {data.daily_rate != null ? (
                <Text style={[styles.mutedSmall, { color: colors.muted, marginTop: 10 }]}>
                  Daily rate {formatCurrency(data.daily_rate, currencyCode)} · payable days this month {data.payable_days_in_month}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.mutedSmall, { color: colors.muted, marginTop: 10 }]}>Hourly — totals from sessions.</Text>
          )}
          {(data.month_late_deduction_total ?? 0) > 0 || (data.today_late_deduction ?? 0) > 0 ? (
            <View style={[styles.lateBreakCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.lateBreakTitle, { color: colors.text }]}>Late pay deduction</Text>
              <Text style={[styles.mutedSmall, { color: colors.muted, marginTop: 4 }]}>
                Base → late → payable (same numbers as payroll after sync).
              </Text>
              <View style={styles.lateBreakGrid}>
                <View>
                  <Text style={[styles.lateBreakLbl, { color: colors.muted }]}>Today base</Text>
                  <Text style={[styles.lateBreakVal, { color: colors.text }]}>
                    {formatCurrency(data.today_base_before_late ?? data.today_earned, currencyCode)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.lateBreakLbl, { color: colors.muted }]}>Today late</Text>
                  <Text style={[styles.lateBreakVal, { color: colors.text }]}>
                    {(data.today_late_deduction ?? 0) > 0
                      ? `−${formatCurrency(data.today_late_deduction ?? 0, currencyCode)}`
                      : "—"}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.lateBreakLbl, { color: colors.muted }]}>Month late</Text>
                  <Text style={[styles.lateBreakVal, { color: colors.text }]}>
                    {(data.month_late_deduction_total ?? 0) > 0
                      ? `−${formatCurrency(data.month_late_deduction_total ?? 0, currencyCode)}`
                      : "—"}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  muted: { fontSize: 14 },
  mutedSmall: { fontSize: 13, marginTop: 10 },
  compactEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  compactRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 4 },
  compactMain: { fontSize: 16, fontWeight: "700" },
  compactLabel: { fontSize: 14, fontWeight: "600" },
  compactDot: { fontSize: 16, fontWeight: "600" },
  compactMuted: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  compactHint: { fontSize: 12, marginTop: 10, lineHeight: 18 },
  earningsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  earningsStat: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  earningsStatLbl: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  earningsStatVal: { fontSize: 18, fontWeight: "800", marginTop: 6 },
  compactLateNote: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  lateBreakCard: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  lateBreakTitle: { fontSize: 13, fontWeight: "700" },
  lateBreakGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 12,
  },
  lateBreakLbl: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  lateBreakVal: { fontSize: 15, fontWeight: "700", marginTop: 4 },
});
