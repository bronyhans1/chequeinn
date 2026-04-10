import React from "react";

interface EmptyStateProps {
  message?: string;
  className?: string;
}

export function EmptyState({ message = "No data", className = "" }: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border py-12 text-center transition-[border-color,background-color] duration-200 ${className}`}
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--surface-muted)",
        color: "var(--text-muted)",
      }}
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
