import React from "react";

interface PageSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function PageSection({ title, children, className = "" }: PageSectionProps) {
  return (
    <section className={className}>
      {title && (
        <h2 className="mb-3 text-sm font-semibold tracking-tight" style={{ color: "var(--text-muted)" }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
