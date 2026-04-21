/**
 * Zod validation schemas for Purchase Order operations.
 * Shared between frontend forms and API route handlers.
 */

import { z } from "zod";
import { DocumentType, InvoiceType, PaymentTerms } from "@prisma/client";

export const CreatePOSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  documentType: z.nativeEnum(DocumentType),
  referenceNumber: z.string().min(1, "Reference number is required").max(100),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  expectedWorkingDays: z
    .number({ invalid_type_error: "Expected working days must be a number" })
    .int()
    .positive("Must be at least 1 day"),
  paymentTerms: z.nativeEnum(PaymentTerms),
  customPaymentDays: z.number().int().positive().optional().nullable(),
  invoiceType: z.nativeEnum(InvoiceType),
  assignedPMId: z.string().min(1, "Project Manager is required"),
  workStartDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const UpdatePOSchema = CreatePOSchema.partial();

export type CreatePOInput = z.infer<typeof CreatePOSchema>;
export type UpdatePOInput = z.infer<typeof UpdatePOSchema>;
