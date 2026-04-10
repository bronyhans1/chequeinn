import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className = "", title }: CardProps) {
  return (
    <div
      className={`rounded-xl border transition-[box-shadow,border-color] duration-200 ${className}`}
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      {title && (
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
