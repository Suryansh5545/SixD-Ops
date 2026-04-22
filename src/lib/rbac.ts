/**
 * Role-Based Access Control (RBAC) matrix.
 *
 * This file stays code-first for default role permissions, while the database
 * now supports direct per-user grants/revokes through User.permissionGrants
 * and User.permissionRevokes.
 */

import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "po:create",
  "po:view_all",
  "po:view_own",
  "po:edit",
  "po:delete",
  "project:create",
  "project:view_all",
  "project:view_own",
  "project:manage",
  "project:update_status",
  "planning:assign_team",
  "planning:assign_equipment",
  "planning:manage_travel",
  "logsheet:submit",
  "logsheet:view_own",
  "logsheet:view_project",
  "logsheet:view_all",
  "logsheet:edit_any",
  "expense:submit",
  "expense:approve",
  "expense:view_project",
  "expense:view_all",
  "mom:create",
  "report:submit",
  "invoice:initiate",
  "invoice:view_own_project",
  "invoice:view_all",
  "invoice:review",
  "invoice:approve",
  "invoice:send",
  "invoice:edit",
  "payment:record",
  "payment:view",
  "compliance:manage",
  "compliance:view",
  "compliance:upload",
  "client:view",
  "client:manage",
  "notification:view_own",
  "dashboard:md",
  "dashboard:cfo",
  "dashboard:bh",
  "dashboard:bm",
  "settings:manage",
  "settings:view",
  "team:manage",
  "team:view_all",
  "team:view_own_division",
  "team:edit_access",
  "team:assign_roles",
  "team:assign_permissions",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface PermissionOverrideSet {
  grants?: string[] | null;
  revokes?: string[] | null;
}

export const ROLE_HIERARCHY: Role[] = [
  "MD",
  "CFO",
  "BUSINESS_HEAD",
  "ACCOUNTS",
  "BUSINESS_MANAGER",
  "BD_TEAM",
  "SALES_TEAM",
  "FIELD_ENGINEER",
];

const ALL_PERMISSIONS = [...PERMISSIONS];
const PERMISSION_SET = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

function normaliseOverrideValues(values?: string[] | null): Permission[] {
  if (!values || values.length === 0) return [];
  return values.filter(isPermission);
}

/**
 * Maps each role to its default permissions.
 */
export const ROLE_PERMISSION_MATRIX: Record<Role, Permission[]> = {
  MD: [...ALL_PERMISSIONS],

  CFO: [
    "po:view_all",
    "project:view_all",
    "logsheet:view_all",
    "expense:view_all",
    "invoice:view_all",
    "payment:view",
    "compliance:view",
    "client:view",
    "notification:view_own",
    "dashboard:cfo",
    "settings:view",
    "audit:view",
  ],

  BUSINESS_HEAD: [
    "po:create",
    "po:view_all",
    "po:edit",
    "project:create",
    "project:view_all",
    "project:manage",
    "project:update_status",
    "planning:assign_team",
    "planning:assign_equipment",
    "planning:manage_travel",
    "logsheet:view_all",
    "expense:approve",
    "expense:view_all",
    "mom:create",
    "report:submit",
    "invoice:initiate",
    "invoice:view_all",
    "invoice:edit",
    "payment:view",
    "compliance:manage",
    "compliance:view",
    "compliance:upload",
    "client:view",
    "client:manage",
    "notification:view_own",
    "dashboard:bh",
    "settings:view",
    "team:manage",
    "team:view_all",
    "team:edit_access",
    "team:assign_roles",
    "audit:view",
  ],

  ACCOUNTS: [
    "po:view_all",
    "project:view_all",
    "invoice:view_all",
    "invoice:review",
    "invoice:approve",
    "invoice:send",
    "invoice:edit",
    "payment:record",
    "payment:view",
    "compliance:view",
    "client:view",
    "notification:view_own",
    "settings:view",
    "audit:view",
  ],

  BD_TEAM: [
    "po:create",
    "po:view_own",
    "client:view",
    "client:manage",
    "notification:view_own",
    "settings:view",
  ],

  BUSINESS_MANAGER: [
    "po:create",
    "po:view_own",
    "project:create",
    "project:view_own",
    "project:manage",
    "project:update_status",
    "planning:assign_team",
    "planning:assign_equipment",
    "planning:manage_travel",
    "logsheet:view_project",
    "expense:approve",
    "expense:view_project",
    "mom:create",
    "report:submit",
    "invoice:initiate",
    "invoice:view_own_project",
    "invoice:edit",
    "payment:view",
    "compliance:manage",
    "compliance:view",
    "compliance:upload",
    "client:view",
    "notification:view_own",
    "dashboard:bm",
    "settings:view",
    "team:view_own_division",
    "audit:view",
  ],

  SALES_TEAM: [
    "po:create",
    "po:view_own",
    "client:view",
    "notification:view_own",
    "settings:view",
  ],

  FIELD_ENGINEER: [
    "logsheet:submit",
    "logsheet:view_own",
    "expense:submit",
    "notification:view_own",
    "settings:view",
  ],
};

export function hasPermission(
  userRoles: Role[],
  permission: Permission,
  overrides?: PermissionOverrideSet
): boolean {
  const grants = new Set(normaliseOverrideValues(overrides?.grants));
  const revokes = new Set(normaliseOverrideValues(overrides?.revokes));

  if (grants.has(permission)) return true;
  if (revokes.has(permission)) return false;

  return userRoles.some((role) => ROLE_PERMISSION_MATRIX[role]?.includes(permission) ?? false);
}

export function hasAllPermissions(
  userRoles: Role[],
  permissions: Permission[],
  overrides?: PermissionOverrideSet
): boolean {
  return permissions.every((permission) => hasPermission(userRoles, permission, overrides));
}

export function hasAnyPermission(
  userRoles: Role[],
  permissions: Permission[],
  overrides?: PermissionOverrideSet
): boolean {
  return permissions.some((permission) => hasPermission(userRoles, permission, overrides));
}

export function getUserPermissions(
  userRoles: Role[],
  overrides?: PermissionOverrideSet
): Permission[] {
  const permissionSet = new Set<Permission>();

  for (const role of userRoles) {
    for (const permission of ROLE_PERMISSION_MATRIX[role] ?? []) {
      permissionSet.add(permission);
    }
  }

  for (const granted of normaliseOverrideValues(overrides?.grants)) {
    permissionSet.add(granted);
  }

  for (const revoked of normaliseOverrideValues(overrides?.revokes)) {
    permissionSet.delete(revoked);
  }

  return Array.from(permissionSet);
}

export function assertPermission(
  userRoles: Role[],
  permission: Permission,
  overrides?: PermissionOverrideSet
): void {
  if (!hasPermission(userRoles, permission, overrides)) {
    throw new Response(
      JSON.stringify({ success: false, error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}
