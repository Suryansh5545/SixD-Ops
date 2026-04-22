"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { hasPermission } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import type { Role } from "@prisma/client";

/**
 * Convenience hook — wraps NextAuth session with helper methods.
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const user = session?.user;
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const userRoles: Role[] = user?.roles
    ? (user.roles as Role[])
    : user?.role
    ? [user.role as Role]
    : [];

  const can = useCallback(
    (permission: Permission) =>
      hasPermission(userRoles, permission, {
        grants: user?.permissionGrants ?? [],
        revokes: user?.permissionRevokes ?? [],
      }),
    [user?.permissionGrants, user?.permissionRevokes, userRoles]
  );

  const logout = useCallback(async () => {
    await signOut({ redirect: false });
    router.push("/login");
  }, [router]);

  return {
    user,
    userRoles,
    isLoading,
    isAuthenticated,
    can,
    logout,
  };
}
