import { z } from "zod";

export const CreateComplianceDocSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  docTypeId: z.string().min(1, "Document type is required"),
  validFrom: z.string().min(1, "Valid from date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  notes: z.string().max(500).optional().nullable(),
  // fileUrl set server-side after upload
});

export const UpdateComplianceDocSchema = z.object({
  validFrom: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().max(500).optional().nullable(),
  fileUrl: z.string().optional(),
});

export const CreateComplianceDocTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(500).optional().nullable(),
  renewalFrequencyDays: z.number().int().positive().optional().nullable(),
  isMandatory: z.boolean().default(true),
});

export type CreateComplianceDocInput = z.infer<typeof CreateComplianceDocSchema>;
export type UpdateComplianceDocInput = z.infer<typeof UpdateComplianceDocSchema>;
export type CreateComplianceDocTypeInput = z.infer<typeof CreateComplianceDocTypeSchema>;
