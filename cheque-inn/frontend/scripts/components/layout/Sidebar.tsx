"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Image from "next/image";
import {
  canAccessManagerFeatures,
  hasRole,
  ADMIN_MANAGER_ROLES,
  canAccessAdminFeatures,
} from "@/lib/auth/roles";

interface NavItem {
  href: string;
  label: string;
  managerOnly?: boolean;
  adminManagerOnly?: boolean;
  /** Company admin only (branch CRUD). */
  adminOnly?: boolean;
  /** Hidden when company payroll is disabled. */
  payrollOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/employees", label: "Employees", managerOnly: true },
  { href: "/attendance", label: "Attendance Overview" },
  { href: "/attendance/history", label: "Attendance history" },
  { href: "/attendance/lateness", label: "Lateness Summary", managerOnly: true },
  { href: "/attendance/flags", label: "Attendance Flags", managerOnly: true },
  { href: "/attendance/absence", label: "Absence Summary", managerOnly: true },
  { href: "/leave", label: "Leave" },
  { href: "/payroll", label: "Payroll" },
  { href: "/branches", label: "Branches", adminOnly: true },
  { href: "/departments", label: "Departments", adminManagerOnly: true },
  { href: "/shifts", label: "Shifts", adminManagerOnly: true },
  { href: "/reports", label: "Reports & Exports", managerOnly: true },
  { href: "/audit", label: "Audit / Activity", adminManagerOnly: true },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isManager = canAccessManagerFeatures(user?.roles);
  const isAdminManager = hasRole(user?.roles, ADMIN_MANAGER_ROLES);
  const isAdmin = canAccessAdminFeatures(user?.roles);

  const payrollEnabled = user?.payrollEnabled !== false;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.payrollOnly && !payrollEnabled) return false;
    if (item.managerOnly && !isManager) return false;
    if (item.adminManagerOnly && !isAdminManager) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <aside
      className="sidebar-shell fixed left-0 top-0 z-30 h-screen w-[var(--sidebar-width)]"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="flex h-full flex-col">
        <div
          className="flex h-[var(--header-height)] items-center border-b px-4"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
        >
          <Link href="/dashboard" className="flex items-center" aria-label="Cheque-Inn home">
            <div className="flex items-center gap-0">
              <Image
                src="/brand/logo-icon.png"
                alt="Cheque-Inn"
                width={120}
                height={40}
                priority
                className="h-[40px] w-auto object-contain"
              />
              <span className="text-[22px] font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
                Cheque-Inn
              </span>
            </div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-link block rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive ? "nav-link-active" : "text-[var(--text-muted)] hover:bg-[var(--nav-hover)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
