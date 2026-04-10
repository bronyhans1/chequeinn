import React from "react";

interface MainContentProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function MainContent({ children, title, className = "" }: MainContentProps) {
  return (
    <main
      className={`min-h-screen pt-[var(--header-height)] ${className}`}
      style={{ marginLeft: "var(--sidebar-width)" }}
    >
      <div className="p-6" style={{ background: "var(--app-bg)", color: "var(--text-primary)" }}>
        {title && (
          <h1 className="mb-6 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h1>
        )}
        {children}
      </div>
    </main>
  );
}
