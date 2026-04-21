/**
 * Permission utilities for use in API routes and server components.
 * Wraps the RBAC matrix with session-aware helpers.
 */

import type { Role } from "@prisma/client";
import { hasPermission, type Permission } from "@/lib/rbac";

/**
 * Returns a 403 JSON response object for use in API routes.
 */
export function forbidden(): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Forbidden — insufficient permissions" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Returns a 401 JSON response object for use in API routes.
 */
export function unauthorized(): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorised — please log in" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Guards an API route. Returns null if authorised, or a Response if not.
 * Usage:
 *   const guard = await guardRoute(session?.user?.roles, "invoice:approve");
 *   if (guard) return guard;
 */
export function guardRoute(
  userRoles: Role[] | undefined | null,
  permission: Permission
): Response | null {
  if (!userRoles || userRoles.length === 0) return unauthorized();
  if (!hasPermission(userRoles, permission)) return forbidden();
  return null;
}

/**
 * Sanitises HTML from a string value to prevent XSS before DB storage.
 * Uses a simple regex strip (safe for plain-text fields).
 * For rich-text fields, use isomorphic-dompurify instead.
 */
export function sanitiseText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Generates the next sequential internal ID for POs and Invoices.
 * Format: prefix-YYYY-NNNN (zero-padded to 4 digits).
 *
 * @param prefix - "SXD-PO" or "SXD-INV"
 * @param lastSequence - The last used sequence number (from DB count)
 */
export function generateInternalId(prefix: string, lastSequence: number): string {
  const year = new Date().getFullYear();
  const seq = String(lastSequence + 1).padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}
