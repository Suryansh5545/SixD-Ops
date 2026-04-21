/**
 * Role-Based Access Control (RBAC) Matrix
 *
 * Centralised permission definitions. Used by:
 *  - API route handlers (server-side enforcement)
 *  - <RoleGuard> component (UI-level conditional rendering)
 *
 * Permission check: hasPermission(userRoles, "invoice:initiate")
 */

import type { Role } from "@prisma/client";

// ─── PERMISSION KEYS ──────────────────────────────────────────────────────────

export type Permission =
  // PO
  | "po:create"
  | "po:view_all"
  | "po:view_own"
  | "po:edit"
  | "po:delete"
  // Project
  | "project:create"
  | "project:view_all"
  | "project:view_own"
  | "project:manage"
  | "project:update_status"
  // Planning
  | "planning:assign_team"
  | "planning:assign_equipment"
  // Log Sheet
  | "logsheet:submit"
  | "logsheet:view_own"
  | "logsheet:view_project"
  | "logsheet:view_all"
  | "logsheet:edit_any"
  // Expense
  | "expense:submit"
  | "expense:approve"
  | "expense:view_project"
  | "expense:view_all"
  // MOM & Report
  | "mom:create"
  | "report:submit"
  // Invoice
  | "invoice:initiate"
  | "invoice:view_own_project"
  | "invoice:view_all"
  | "invoice:review"
  | "invoice:approve"
  | "invoice:send"
  | "invoice:edit"
  // Payment
  | "payment:record"
  | "payment:view"
  // Compliance
  | "compliance:manage"
  | "compliance:view"
  | "compliance:upload"
  // Notifications
  | "notification:view_own"
  // Dashboard
  | "dashboard:md"
  | "dashboard:cfo"
  | "dashboard:bh"
  | "dashboard:pm"
  // Settings
  | "settings:manage"
  | "settings:view"
  // Team / Engineers
  | "team:manage"
  | "team:view_all"
  | "team:view_own_division"
  // Audit
  | "audit:view";

// ─── RBAC MATRIX ─────────────────────────────────────────────────────────────

/**
 * Maps each Role to the set of Permissions it holds.
 * Add a permission to a role's array to grant it.
 */
const RBAC_MATRIX: Record<Role, Permission[]> = {
  MD: [
    "po:create", "po:view_all", "po:edit", "po:delete",
    "project:create", "project:view_all", "project:manage", "project:update_status",
    "planning:assign_team", "planning:assign_equipment",
    "logsheet:submit", "logsheet:view_own", "logsheet:view_project", "logsheet:view_all", "logsheet:edit_any",
    "expense:submit", "expense:approve", "expense:view_project", "expense:view_all",
    "mom:create", "report:submit",
    "invoice:initiate", "invoice:view_own_project", "invoice:view_all", "invoice:review", "invoice:approve", "invoice:send", "invoice:edit",
    "payment:record", "payment:view",
    "compliance:manage", "compliance:view", "compliance:upload",
    "notification:view_own",
    "dashboard:md", "dashboard:cfo", "dashboard:bh", "dashboard:pm",
    "settings:manage", "settings:view",
    "team:manage", "team:view_all",
    "audit:view",
  ],

  CFO: [
    "po:view_all",
    "project:view_all",
    "logsheet:view_all",
    "expense:view_all",
    "invoice:view_all",
    "payment:view",
    "compliance:view",
    "notification:view_own",
    "dashboard:cfo",
    "settings:view",
    "team:view_all",
    "audit:view",
  ],

  BUSINESS_HEAD: [
    "po:create", "po:view_all", "po:edit",
    "project:view_all",
    "logsheet:view_all",
    "expense:view_all",
    "invoice:view_all",
    "payment:view",
    "compliance:view",
    "notification:view_own",
    "dashboard:bh",
    "settings:view",
    "team:manage", "team:view_all",
    "audit:view",
  ],

  BUSINESS_MANAGER_STEEL: [
    "po:create", "po:view_own",
    "project:view_own",
    "invoice:view_own_project",
    "compliance:manage", "compliance:view", "compliance:upload",
    "notification:view_own",
    "team:view_own_division",
    "audit:view",
  ],

  BUSINESS_MANAGER_TATA_GOVT: [
    "po:create", "po:view_own",
    "project:view_own",
    "invoice:view_own_project",
    "compliance:manage", "compliance:view", "compliance:upload",
    "notification:view_own",
    "team:view_own_division",
    "audit:view",
  ],

  BD_TEAM: [
    "po:create", "po:view_own",
    "project:view_own",
    "notification:view_own",
  ],

  PROJECT_MANAGER: [
    "po:view_own",
    "project:create", "project:view_own", "project:manage", "project:update_status",
    "planning:assign_team", "planning:assign_equipment",
    "logsheet:view_project",
    "expense:approve", "expense:view_project",
    "mom:create", "report:submit",
    "invoice:initiate", "invoice:view_own_project", "invoice:edit",
    "payment:view",
    "compliance:view",
    "notification:view_own",
    "dashboard:pm",
    "team:view_own_division",
    "audit:view",
  ],

  FIELD_ENGINEER: [
    "logsheet:submit", "logsheet:view_own",
    "expense:submit",
    "notification:view_own",
  ],

  ADMIN_COORDINATOR: [
    "project:view_all",
    "team:manage",
    "team:view_all",
    "notification:view_own",
    "settings:view",
  ],

  ACCOUNTS: [
    "po:view_all",
    "project:view_all",
    "invoice:view_all", "invoice:review", "invoice:approve", "invoice:send",
    "payment:record", "payment:view",
    "compliance:view",
    "notification:view_own",
    "settings:view",
    "audit:view",
  ],
};

// ─── PERMISSION CHECK HELPERS ─────────────────────────────────────────────────

/**
 * Returns true if any of the user's roles grants the requested permission.
 *
 * @param userRoles - Array of Role values from the user's session (supports multi-role)
 * @param permission - The permission to check
 */
export function hasPermission(userRoles: Role[], permission: Permission): boolean {
  return userRoles.some((role) =>
    RBAC_MATRIX[role]?.includes(permission) ?? false
  );
}

/**
 * Returns true if the user has ALL of the requested permissions.
 */
export function hasAllPermissions(userRoles: Role[], permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(userRoles, p));
}

/**
 * Returns true if the user has ANY of the requested permissions.
 */
export function hasAnyPermission(userRoles: Role[], permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(userRoles, p));
}

/**
 * Returns all permissions a user holds (union of all their roles' permissions).
 */
export function getUserPermissions(userRoles: Role[]): Permission[] {
  const permSet = new Set<Permission>();
  for (const role of userRoles) {
    for (const perm of RBAC_MATRIX[role] ?? []) {
      permSet.add(perm);
    }
  }
  return Array.from(permSet);
}

/**
 * Throws a 403 Response if the user does not have the required permission.
 * Use in API route handlers after requireAuth().
 */
export function assertPermission(userRoles: Role[], permission: Permission): void {
  if (!hasPermission(userRoles, permission)) {
    throw new Response(
      JSON.stringify({ success: false, error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}
