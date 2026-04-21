import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";

export const CreateExpenseSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  category: z.nativeEnum(ExpenseCategory, { required_error: "Category is required" }),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0"),
  description: z.string().max(500).optional().nullable(),
  // receiptUrl is set server-side after file upload
});

export const ApproveExpenseSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type ApproveExpenseInput = z.infer<typeof ApproveExpenseSchema>;
