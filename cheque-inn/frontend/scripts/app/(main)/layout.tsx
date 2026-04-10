"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SupportLauncher } from "@/components/support/SupportLauncher";
import { useAuth } from "@/lib/auth/AuthContext";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (isPlatformAdmin(user.roles)) {
      router.replace("/platform/companies");
    }
  }, [isLoading, router, user]);

  return (
    <RouteGuard>
      <Sidebar />
      <Header />
      {children}
      <SupportLauncher />
    </RouteGuard>
  );
}
