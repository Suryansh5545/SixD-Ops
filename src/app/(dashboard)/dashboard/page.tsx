"use client";

/**
 * Dashboard landing page.
 * Redirects each role to the appropriate dashboard subpage.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { useAuth } from "@/hooks/useAuth";

const ROLE_DASHBOARD_MAP: Partial<Record<Role, string>> = {
  MD: "/dashboard/md",
  CFO: "/dashboard/cfo",
  BUSINESS_HEAD: "/dashboard/bh",
  BUSINESS_MANAGER: "/dashboard/pm",
  FIELD_ENGINEER: "/projects",
  BD_TEAM: "/pos",
  SALES_TEAM: "/pos",
  ACCOUNTS: "/invoices",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    const primaryRole = user.role as Role;
    const destination = ROLE_DASHBOARD_MAP[primaryRole] ?? "/projects";

    router.replace(destination);
  }, [isAuthenticated, isLoading, router, user]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecting...
    </div>
  );
}
