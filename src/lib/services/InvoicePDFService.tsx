/**
 * Invoice PDF Service
 * Uses @react-pdf/renderer to generate invoice PDFs server-side.
 * Returns a Buffer that can be streamed via Next.js API route.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Image,
  Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoicePDFData {
  invoiceNumber: string;
  issuedAt: Date;
  dueDate?: Date;
  client: {
    name: string;
    address?: string;
    gstin?: string;
  };
  project: {
    projectId: string;
    title: string;
    po: { poNumber: string };
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  company: {
    name: string;
    address: string;
    gstin: string;
    pan: string;
    email: string;
    phone: string;
    bankName: string;
    bankAccount: string;
    bankIFSC: string;
    bankBranch: string;
  };
  notes?: string;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BRAND = "#E85122";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    padding: 40,
    backgroundColor: "#FFFFFF",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2px solid ${BRAND}`,
  },
  logo: {
    width: 80,
    height: 32,
    objectFit: "contain",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    letterSpacing: 2,
  },
  invoiceNumber: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  // Parties section
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  partyBlock: {
    flex: 1,
    marginRight: 20,
  },
  partyTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 1,
  },
  // Project reference
  refBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    padding: "8 12",
    marginBottom: 20,
    flexDirection: "row",
    gap: 24,
  },
  refItem: {
    flex: 1,
  },
  refLabel: {
    fontSize: 7,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  refValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND,
    color: "#FFFFFF",
    padding: "6 8",
    borderRadius: "2 2 0 0",
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottom: "1px solid #F3F4F6",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colUnit: { flex: 1.2, textAlign: "right" },
  colAmount: { flex: 1.2, textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  cellText: { fontSize: 8 },
  // Totals
  totalsSection: {
    alignItems: "flex-end",
    marginTop: 12,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: "row",
    width: 240,
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: { fontSize: 9, color: "#6B7280" },
  totalValue: { fontSize: 9 },
  grandTotalRow: {
    flexDirection: "row",
    width: 240,
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTop: `1.5px solid ${BRAND}`,
    marginTop: 4,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BRAND },
  // Balance
  balanceBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
    padding: "4 8",
    flexDirection: "row",
    justifyContent: "space-between",
    width: 240,
    marginTop: 4,
  },
  // Bank details
  bankSection: {
    backgroundColor: "#F0FDF4",
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  bankTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bankItem: {
    width: "48%",
  },
  bankLabel: { fontSize: 7, color: "#6B7280", marginBottom: 1 },
  bankValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Footer
  footer: {
    borderTop: "1px solid #E5E7EB",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerLeft: { flex: 1 },
  footerText: { fontSize: 7, color: "#9CA3AF" },
  signatureBox: { width: 120, alignItems: "center" },
  signatureLine: {
    borderTop: "1px solid #374151",
    width: 100,
    marginBottom: 4,
    marginTop: 20,
  },
  signatureLabel: { fontSize: 7, color: "#6B7280" },
});

// ─── PDF Component ────────────────────────────────────────────────────────────

function InvoicePDF({ data }: { data: InvoicePDFData }) {
  const formatCurrency = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const balance = data.totalAmount - data.paidAmount;

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author="SixD Engineering Solutions Pvt. Ltd."
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND }}>
              SixD Engineering Solutions
            </Text>
            <Text style={{ fontSize: 8, color: "#6B7280", marginTop: 2 }}>
              Pvt. Ltd. | ISO 9001:2015 | OHSAS 18001
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={{ fontSize: 8, color: "#6B7280", marginTop: 4 }}>
              Date: {format(data.issuedAt, "dd MMMM yyyy")}
            </Text>
            {data.dueDate && (
              <Text style={{ fontSize: 8, color: "#EF4444" }}>
                Due: {format(data.dueDate, "dd MMMM yyyy")}
              </Text>
            )}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyTitle}>Bill To</Text>
            <Text style={styles.partyName}>{data.client.name}</Text>
            {data.client.address && (
              <Text style={styles.partyDetail}>{data.client.address}</Text>
            )}
            {data.client.gstin && (
              <Text style={styles.partyDetail}>GSTIN: {data.client.gstin}</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.partyTitle}>From</Text>
            <Text style={styles.partyName}>{data.company.name}</Text>
            <Text style={styles.partyDetail}>{data.company.address}</Text>
            <Text style={styles.partyDetail}>GSTIN: {data.company.gstin}</Text>
            <Text style={styles.partyDetail}>PAN: {data.company.pan}</Text>
            <Text style={styles.partyDetail}>{data.company.email}</Text>
          </View>
        </View>

        {/* Project Reference */}
        <View style={styles.refBox}>
          <View style={styles.refItem}>
            <Text style={styles.refLabel}>Project</Text>
            <Text style={styles.refValue}>{data.project.projectId}</Text>
          </View>
          <View style={styles.refItem}>
            <Text style={styles.refLabel}>Description</Text>
            <Text style={styles.refValue}>{data.project.title}</Text>
          </View>
          <View style={styles.refItem}>
            <Text style={styles.refLabel}>PO Reference</Text>
            <Text style={styles.refValue}>{data.project.po.poNumber}</Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.colDesc]}>Description</Text>
          <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
          <Text style={[styles.headerText, styles.colUnit]}>Unit Price</Text>
          <Text style={[styles.headerText, styles.colAmount]}>Amount</Text>
        </View>

        {data.lineItems.map((item, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={[styles.cellText, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.cellText, styles.colUnit]}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={[styles.cellText, styles.colAmount]}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST ({data.gstPercent}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.gstAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandLabel}>Total Amount</Text>
            <Text style={styles.grandValue}>{formatCurrency(data.totalAmount)}</Text>
          </View>
          {data.paidAmount > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Amount Paid</Text>
                <Text style={{ ...styles.totalValue, color: "#16A34A" }}>
                  ({formatCurrency(data.paidAmount)})
                </Text>
              </View>
              <View style={styles.balanceBadge}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Balance Due</Text>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#D97706" }}>
                  {formatCurrency(balance)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Bank Details */}
        <View style={styles.bankSection}>
          <Text style={styles.bankTitle}>Bank Details for Payment</Text>
          <View style={styles.bankGrid}>
            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Bank Name</Text>
              <Text style={styles.bankValue}>{data.company.bankName}</Text>
            </View>
            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Account Number</Text>
              <Text style={styles.bankValue}>{data.company.bankAccount}</Text>
            </View>
            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>IFSC Code</Text>
              <Text style={styles.bankValue}>{data.company.bankIFSC}</Text>
            </View>
            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Branch</Text>
              <Text style={styles.bankValue}>{data.company.bankBranch}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4, color: "#6B7280" }}>
              NOTES
            </Text>
            <Text style={{ fontSize: 8, color: "#374151" }}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerText}>
              This is a computer generated invoice. No signature required unless stated.
            </Text>
            <Text style={styles.footerText}>
              For queries: {data.company.email} | {data.company.phone}
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorised Signatory</Text>
            <Text style={[styles.signatureLabel, { fontFamily: "Helvetica-Bold" }]}>
              SixD Engineering Solutions Pvt. Ltd.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const element = React.createElement(InvoicePDF, { data });
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
