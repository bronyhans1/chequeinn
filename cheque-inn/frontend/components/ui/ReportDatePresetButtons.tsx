"use client";

import {
  applyReportDatePresetRange,
  type ReportDatePresetId,
} from "@/lib/utils/date";

const PRESETS: { id: ReportDatePresetId; label: string }[] = [
  { id: "last_7_days", label: "Last 7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

export function ReportDatePresetButtons({
  onSelect,
  disabled,
  className = "",
}: {
  onSelect: (start: string, end: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-theme-muted">Quick ranges:</span>
      {PRESETS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => {
            const r = applyReportDatePresetRange(id);
            onSelect(r.start, r.end);
          }}
          className="btn-preset"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
