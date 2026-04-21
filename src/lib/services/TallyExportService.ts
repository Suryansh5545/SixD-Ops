/**
 * TallyExportService — Generates CSV exports for Tally accounting software.
 *
 * Output format: One row per invoice line item.
 * Download is client-side (no server storage needed).
 */

import type { InvoiceData } from "@/types";
import { formatDate } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/currency";

interface TallyRow {
  "Invoice Number": string;
  "Invoice Date": string;
  "Client Name": string;
  "GST Number": string;
  "PO Reference": string;
  "Line Item Description": string;
  "Quantity": number;
  "Rate (INR)": number;
  "Line Amount (INR)": number;
  "Subtotal (INR)": number;
  "GST %": number;
  "GST Amount (INR)": number;
  "Total Amount (INR)": number;
  "Payment Terms": string;
  "Invoice Status": string;
}

class TallyExportServiceClass {
  /**
   * Generates a CSV string for a single invoice.
   *
   * @param invoice - Full invoice data with project and client details
   * @returns CSV string ready for download
   */
  generateSingleCSV(invoice: InvoiceData): string {
    const rows: TallyRow[] = invoice.lineItems.map((item) => ({
      "Invoice Number": invoice.invoiceNumber,
      "Invoice Date": formatDate(invoice.invoiceDate),
      "Client Name": invoice.project.client.name,
      "GST Number": invoice.project.client.gstNumber ?? "",
      "PO Reference": invoice.project.po.referenceNumber,
      "Line Item Description": item.description,
      "Quantity": item.quantity,
      "Rate (INR)": item.rate,
      "Line Amount (INR)": item.amount,
      "Subtotal (INR)": toNumber(invoice.subtotal),
      "GST %": invoice.gstPercent,
      "GST Amount (INR)": toNumber(invoice.gstAmount),
      "Total Amount (INR)": toNumber(invoice.totalAmount),
      "Payment Terms": invoice.project.po.paymentTerms,
      "Invoice Status": invoice.status,
    }));

    return this.rowsToCSV(rows);
  }

  /**
   * Generates a CSV string for multiple invoices (bulk export).
   *
   * @param invoices - Array of invoice data
   * @returns CSV string ready for download
   */
  generateBulkCSV(invoices: InvoiceData[]): string {
    const rows: TallyRow[] = invoices.flatMap((invoice) =>
      invoice.lineItems.map((item) => ({
        "Invoice Number": invoice.invoiceNumber,
        "Invoice Date": formatDate(invoice.invoiceDate),
        "Client Name": invoice.project.client.name,
        "GST Number": invoice.project.client.gstNumber ?? "",
        "PO Reference": invoice.project.po.referenceNumber,
        "Line Item Description": item.description,
        "Quantity": item.quantity,
        "Rate (INR)": item.rate,
        "Line Amount (INR)": item.amount,
        "Subtotal (INR)": toNumber(invoice.subtotal),
        "GST %": invoice.gstPercent,
        "GST Amount (INR)": toNumber(invoice.gstAmount),
        "Total Amount (INR)": toNumber(invoice.totalAmount),
        "Payment Terms": invoice.project.po.paymentTerms,
        "Invoice Status": invoice.status,
      }))
    );

    return this.rowsToCSV(rows);
  }

  /**
   * Converts an array of row objects into a CSV string.
   * Handles commas and quotes in values.
   */
  private rowsToCSV(rows: TallyRow[]): string {
    if (rows.length === 0) return "";

    const headers = Object.keys(rows[0]) as (keyof TallyRow)[];
    const headerRow = headers.map((h) => this.escapeCSV(String(h))).join(",");

    const dataRows = rows.map((row) =>
      headers.map((h) => this.escapeCSV(String(row[h]))).join(",")
    );

    return [headerRow, ...dataRows].join("\n");
  }

  /**
   * Escapes a value for CSV output.
   * Wraps in quotes if the value contains commas, quotes, or newlines.
   */
  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Returns a filename for the CSV download.
   */
  getFilename(invoiceNumber?: string): string {
    const date = new Date().toISOString().split("T")[0];
    if (invoiceNumber) {
      return `Tally_Export_${invoiceNumber}_${date}.csv`;
    }
    return `Tally_Export_Bulk_${date}.csv`;
  }
}

export const TallyExportService = new TallyExportServiceClass();

// ─── Prisma-model compatible helper ──────────────────────────────────────────

export interface InvoiceWithRelations {
  invoiceNumber: string;
  issuedAt: Date | null;
  status: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  project: {
    projectId: string;
    title: string;
    po: {
      poNumber: string;
      client: {
        name: string;
        gstin?: string | null;
        gstPercent: number;
      };
    };
  };
}

// Extend the class singleton with a Prisma-model method
Object.assign(TallyExportService, {
  generateCSV(invoices: InvoiceWithRelations[]): string {
    if (invoices.length === 0) return "";

    const headers = [
      "Invoice Number",
      "Invoice Date",
      "Client Name",
      "Client GSTIN",
      "PO Reference",
      "Project ID",
      "Line Item Description",
      "Quantity",
      "Rate (INR)",
      "Line Amount (INR)",
      "Subtotal (INR)",
      "GST %",
      "GST Amount (INR)",
      "Total Amount (INR)",
      "Paid Amount (INR)",
      "Balance Due (INR)",
      "Invoice Status",
    ];

    const escapeCSV = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const rows = invoices.flatMap((inv) =>
      inv.lineItems.map((item) => [
        inv.invoiceNumber,
        inv.issuedAt ? inv.issuedAt.toISOString().split("T")[0] : "",
        inv.project.po.client.name,
        inv.project.po.client.gstin ?? "",
        inv.project.po.poNumber,
        inv.project.projectId,
        item.description,
        String(item.quantity),
        String(item.unitPrice),
        String(item.amount),
        String(inv.subtotal),
        String(inv.project.po.client.gstPercent),
        String(inv.gstAmount),
        String(inv.totalAmount),
        String(inv.paidAmount),
        String(inv.totalAmount - inv.paidAmount),
        inv.status,
      ].map(escapeCSV).join(","))
    );

    return [headers.map(escapeCSV).join(","), ...rows].join("\n");
  },
});
