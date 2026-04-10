import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const variants = {
  default:
    "border border-slate-200/80 bg-slate-100/90 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/80 dark:text-slate-200",
  success:
    "border border-emerald-200/70 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-200",
  warning:
    "border border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200",
  danger:
    "border border-red-200/80 bg-red-50/90 text-red-900 dark:border-red-800/50 dark:bg-red-950/55 dark:text-red-200",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
