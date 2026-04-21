/**
 * Date utility functions.
 * All server-side timestamps are stored in UTC.
 * Display is converted to IST (UTC+5:30) for Indian users.
 */

import {
  format,
  parseISO,
  differenceInDays,
  differenceInHours,
  isAfter,
  isBefore,
  addDays,
  formatDistanceToNow,
} from "date-fns";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Converts a UTC Date/string to IST and formats it.
 * @param date - UTC date
 * @param fmt - date-fns format string (default: "dd MMM yyyy, hh:mm a")
 */
export function toIST(date: Date | string, fmt = "dd MMM yyyy, hh:mm a"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return format(ist, fmt);
}

/**
 * Formats a date-only value (no time component).
 * @param date - Date or ISO string
 * @param fmt - format string (default: "dd MMM yyyy")
 */
export function formatDate(date: Date | string | null | undefined, fmt = "dd MMM yyyy"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

/**
 * Returns days remaining until expiry. Negative = already expired.
 */
export function daysUntilExpiry(expiryDate: Date | string): number {
  const d = typeof expiryDate === "string" ? parseISO(expiryDate) : expiryDate;
  return differenceInDays(d, new Date());
}

/**
 * Returns hours between two timestamps (used for clock-in/out calculation).
 */
export function hoursBetween(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? parseISO(start) : start;
  const e = typeof end === "string" ? parseISO(end) : end;
  const diff = differenceInHours(e, s);
  // More precise: use ms difference
  const ms = e.getTime() - s.getTime();
  return Math.round((ms / 3_600_000) * 100) / 100;
}

/**
 * Returns "X days ago" or "in X days" relative string.
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Returns true if date is within N days from now (upcoming expiry check).
 */
export function isExpiringWithin(date: Date | string, days: number): boolean {
  const d = typeof date === "string" ? parseISO(date) : date;
  const threshold = addDays(new Date(), days);
  return isBefore(d, threshold) && isAfter(d, new Date());
}

/**
 * Returns true if date is in the past (expired).
 */
export function isExpired(date: Date | string): boolean {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isBefore(d, new Date());
}

export type ComplianceStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING";

/**
 * Computes compliance document status based on expiry date.
 */
export function computeComplianceStatus(expiryDate: Date | string): ComplianceStatus {
  if (isExpired(expiryDate)) return "EXPIRED";
  if (isExpiringWithin(expiryDate, 30)) return "EXPIRING_SOON";
  return "VALID";
}

/**
 * Returns the ISO date string for a Date (YYYY-MM-DD).
 */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Returns a Date set to 08:00 IST for cron job scheduling reference.
 */
export function getISTMorning(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setHours(8, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS); // Back to UTC
}
