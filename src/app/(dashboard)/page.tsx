/**
 * Root dashboard redirect page.
 * Redirects each role to their appropriate dashboard.
 */

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

const ROLE_DASHBOARD_MAP: Partial<Record<Role, string>> = {
  MD: "/dashboard/md",
  CFO: "/dashboard/cfo",
  BUSINESS_HEAD: "/dashboard/bh",
  PROJECT_MANAGER: "/dashboard/pm",
  BUSINESS_MANAGER_STEEL: "/dashboard/bh",
  BUSINESS_MANAGER_TATA_GOVT: "/dashboard/bh",
  FIELD_ENGINEER: "/projects",
  BD_TEAM: "/pos",
  ADMIN_COORDINATOR: "/projects",
  ACCOUNTS: "/invoices",
};

export default async function DashboardRootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const primaryRole = session.user.role as Role;
  const destination = ROLE_DASHBOARD_MAP[primaryRole] ?? "/projects";

  redirect(destination);
}
