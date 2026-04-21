import { z } from "zod";
import { DailyStatus } from "@prisma/client";

export const ClockInSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  dailyStatus: z.nativeEnum(DailyStatus),
  progressRemarks: z.string().max(1000).optional().nullable(),
});

export const ClockOutSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  progressRemarks: z.string().max(1000).optional().nullable(),
  reportStatus: z.string().max(100).optional().nullable(),
  clientCountersignatureUrl: z.string().optional().nullable(),
});

export const UpdateLogEntrySchema = z.object({
  dailyStatus: z.nativeEnum(DailyStatus).optional(),
  progressRemarks: z.string().max(1000).optional().nullable(),
  reportStatus: z.string().max(100).optional().nullable(),
  clientCountersignatureUrl: z.string().optional().nullable(),
});

export const CreateLogEntrySchema = z.object({
  projectId: z.string().min(1),
  engineerId: z.string().min(1),
  date: z.string().min(1),
  clockIn: z.string().optional().nullable(),
  clockOut: z.string().optional().nullable(),
  dailyStatus: z.nativeEnum(DailyStatus),
  progressRemarks: z.string().max(1000).optional().nullable(),
  reportStatus: z.string().max(100).optional().nullable(),
});

export type ClockInInput = z.infer<typeof ClockInSchema>;
export type ClockOutInput = z.infer<typeof ClockOutSchema>;
export type UpdateLogEntryInput = z.infer<typeof UpdateLogEntrySchema>;
export type CreateLogEntryInput = z.infer<typeof CreateLogEntrySchema>;
