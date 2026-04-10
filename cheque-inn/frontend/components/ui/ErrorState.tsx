import React from "react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className = "" }: ErrorStateProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-150 ${className}`}
      style={{
        borderColor: "var(--state-error-border)",
        background: "var(--state-error-bg)",
      }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--state-error-text)" }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          style={{
            background: "var(--state-error-btn-bg)",
            color: "var(--state-error-text)",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
