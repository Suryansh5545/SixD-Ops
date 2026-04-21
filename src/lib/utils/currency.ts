/**
 * Currency utility functions for Indian Rupee formatting.
 * All amounts in the database are stored as Prisma Decimal (serialised as string).
 */

/**
 * Formats a number or string as Indian Rupee.
 * e.g. 150000 → "₹1,50,000"
 *
 * @param amount - Number, string, or null/undefined
 * @param decimals - Decimal places (default: 2)
 */
export function formatINR(
  amount: number | string | null | undefined,
  decimals = 2
): string {
  if (amount === null || amount === undefined) return "₹0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formats a number in Indian lakh/crore notation for dashboard display.
 * e.g. 1500000 → "15.00 L" | 15000000 → "1.50 Cr"
 */
export function formatCompact(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0";

  if (num >= 10_000_000) {
    return `₹${(num / 10_000_000).toFixed(2)} Cr`;
  }
  if (num >= 100_000) {
    return `₹${(num / 100_000).toFixed(2)} L`;
  }
  return formatINR(num, 0);
}

/**
 * Safely converts a Prisma Decimal string to a JS number.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
}

/**
 * Calculates GST amount from subtotal and GST percentage.
 */
export function calcGST(subtotal: number, gstPercent: number): number {
  return Math.round(subtotal * (gstPercent / 100) * 100) / 100;
}

/**
 * Returns the daily rate implied by a PO: amount / expectedWorkingDays.
 * Returns 0 if expectedWorkingDays is 0.
 */
export function calcDailyRate(poAmount: number, expectedWorkingDays: number): number {
  if (expectedWorkingDays === 0) return 0;
  return Math.round((poAmount / expectedWorkingDays) * 100) / 100;
}
