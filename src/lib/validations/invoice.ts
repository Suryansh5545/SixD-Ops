import { z } from "zod";
import { InvoiceBillingLine, InvoiceStatus } from "@prisma/client";

export const InvoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(300),
  quantity: z.number().positive("Quantity must be positive"),
  rate: z.number().nonnegative("Rate cannot be negative"),
  amount: z.number().nonnegative("Amount cannot be negative"),
  type: z.nativeEnum(InvoiceBillingLine),
});

export const CreateInvoiceSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  poId: z.string().min(1, "PO is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  lineItems: z
    .array(InvoiceLineItemSchema)
    .min(1, "At least one line item is required"),
  gstPercent: z.number().min(0).max(28),
  workingSheetUrl: z.string().optional().nullable(),
});

export const UpdateInvoiceSchema = z.object({
  invoiceDate: z.string().optional(),
  lineItems: z.array(InvoiceLineItemSchema).optional(),
  gstPercent: z.number().min(0).max(28).optional(),
  workingSheetUrl: z.string().optional().nullable(),
  reviewNotes: z.string().max(1000).optional().nullable(),
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
  sentMethod: z.string().optional().nullable(),
  reviewNotes: z.string().max(1000).optional().nullable(),
});

export const RecordPaymentSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0"),
  paymentDate: z.string().min(1, "Payment date is required"),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof UpdateInvoiceStatusSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type InvoiceLineItemInput = z.infer<typeof InvoiceLineItemSchema>;
