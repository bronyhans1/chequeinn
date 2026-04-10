"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProfileDrawer } from "@/components/profile/ProfileDrawer";

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (user?.profileCompletion && !user.profileCompletion.requiredComplete) {
      setProfileOpen(true);
    }
  }, [user?.profileCompletion]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <>
      <header
        className="fixed right-0 top-0 z-20 flex h-[var(--header-height)] items-center justify-between border-b px-6"
        style={{ left: "var(--sidebar-width)", borderColor: "var(--border-soft)", background: "var(--surface)" }}
      >
        <div className="flex-1">
          {user?.profileCompletion && !user.profileCompletion.requiredComplete ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/95 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/55 dark:text-amber-200">
              <span>Complete required profile items</span>
              <span
                className="rounded px-1.5 py-0.5 font-semibold"
                style={{ background: "var(--surface)", color: "var(--text-primary)" }}
              >
                {2 - user.profileCompletion.missingRequiredFields.length}/2
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
        {user && (
          <>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-3 rounded-lg border px-3 py-1.5 transition-all duration-150 hover:bg-[var(--nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 active:scale-[0.99]"
                style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/45 dark:text-primary-200">
                  {user.profilePhotoUrl ? (
                    <img src={user.profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    (user.firstName?.[0] ?? user.email[0] ?? "U").toUpperCase()
                  )}
                </div>
                <span className="text-left">
                  <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {[user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                    {user.roles?.join(", ") || "User"}
                  </span>
                </span>
              </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-[var(--nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
              style={{ color: "var(--text-muted)" }}
            >
              Sign out
            </button>
          </>
        )}
        </div>
      </header>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
