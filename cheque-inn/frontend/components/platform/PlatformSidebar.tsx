"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/platform/dashboard", label: "Dashboard" },
  { href: "/platform/companies", label: "Companies" },
  { href: "/platform/audit", label: "Audit Logs" },
  { href: "/platform/settings", label: "System Settings" },
];

export function PlatformSidebar() {
  const pathname = usePathname();

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
          <Link href="/platform/dashboard" className="flex items-center" aria-label="Cheque-Inn platform home">
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
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
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

