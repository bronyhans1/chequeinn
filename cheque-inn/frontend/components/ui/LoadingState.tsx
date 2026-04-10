import React from "react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading…", className = "" }: LoadingStateProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border py-14 ${className}`}
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
