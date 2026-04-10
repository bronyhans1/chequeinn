import type { ThemePalette } from "@/store/theme";

/** Leave request row badges — light + dark safe. */
export function leaveStatusBadge(colors: ThemePalette, status: string) {
  const s = status?.toUpperCase() ?? "";
  if (s === "APPROVED") {
    return {
      bg: colors.toneSuccessBg,
      text: colors.toneSuccessText,
      label: "Approved" as const,
    };
  }
  if (s === "REJECTED") {
    return {
      bg: colors.toneDangerBg,
      text: colors.toneDangerText,
      label: "Rejected" as const,
    };
  }
  return {
    bg: colors.toneWarningBg,
    text: colors.toneWarningText,
    label: "Pending" as const,
  };
}

/** Attendance session list status chip. */
export function sessionStatusBadge(colors: ThemePalette, status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE") {
    return { label: "Active" as const, color: colors.warning, bg: colors.toneWarningBg };
  }
  if (s === "COMPLETED") {
    return { label: "Completed" as const, color: colors.success, bg: colors.toneSuccessBg };
  }
  if (s === "CANCELLED") {
    return { label: "Cancelled" as const, color: colors.toneNeutralText, bg: colors.toneNeutralBg };
  }
  return { label: status, color: colors.muted, bg: colors.toneNeutralBg };
}
