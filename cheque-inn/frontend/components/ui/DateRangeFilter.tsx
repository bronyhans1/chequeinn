"use client";

import React from "react";

interface DateRangeFilterProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onApply: () => void;
  loading?: boolean;
  showApply?: boolean;
  className?: string;
}

export function DateRangeFilter({
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  loading = false,
  showApply = true,
  className = "",
}: DateRangeFilterProps) {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      <div>
        <label htmlFor="date-start" className="mb-1 block text-xs font-medium text-theme-muted">
          From
        </label>
        <input
          id="date-start"
          type="date"
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
          className="input-field"
        />
      </div>
      <div>
        <label htmlFor="date-end" className="mb-1 block text-xs font-medium text-theme-muted">
          To
        </label>
        <input
          id="date-end"
          type="date"
          value={end}
          onChange={(e) => onEndChange(e.target.value)}
          className="input-field"
        />
      </div>
      {showApply && (
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      )}
    </div>
  );
}
