"use client";

import { useSession } from "next-auth/react";
import { hasPermission, hasAnyPermission, type Permission } from "@/lib/rbac";
import type { Role } from "@prisma/client";

interface RoleGuardProps {
  /** Single permission required */
  permission?: Permission;
  /** Any one of these permissions is sufficient */
  anyPermission?: Permission[];
  /** Fallback rendered when access is denied (default: null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's roles.
 * Used for hiding/showing UI elements like buttons, tabs, and form sections.
 *
 * Server-side enforcement still happens at the API level — this is UI-only.
 */
export function RoleGuard({ permission, anyPermission, fallback = null, children }: RoleGuardProps) {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as Role[];

  let allowed = false;

  if (permission) {
    allowed = hasPermission(userRoles, permission);
  } else if (anyPermission) {
    allowed = hasAnyPermission(userRoles, anyPermission);
  } else {
    allowed = true; // No restriction specified
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
