import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, subtitle, className = "" }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-[box-shadow,border-color] duration-200 ${className}`}
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{title}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)", opacity: 0.85 }}>{subtitle}</p>
      )}
    </div>
  );
}
