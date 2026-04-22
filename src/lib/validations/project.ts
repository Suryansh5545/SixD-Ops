import { z } from "zod";
import { Division, ProjectStatus } from "@prisma/client";

export const CreateProjectSchema = z.object({
  poId: z.string().min(1, "PO is required"),
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  division: z.nativeEnum(Division).optional().nullable(),
  pmId: z.string().min(1, "Business Manager is required"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  daysAuthorised: z.number().int().positive("Days authorised must be positive"),
  siteLocation: z.string().max(200).optional().nullable(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  division: z.nativeEnum(Division).optional().nullable(),
  pmId: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  daysAuthorised: z.number().int().positive().optional(),
  siteLocation: z.string().max(200).optional().nullable(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export const AssignTeamSchema = z.object({
  engineers: z
    .array(
      z.object({
        engineerId: z.string().min(1),
        role: z.string().min(1, "Role is required"),
        startDate: z.string().min(1, "Start date is required"),
        endDate: z.string().optional().nullable(),
        equipmentId: z.string().optional().nullable(),
      })
    )
    .min(1, "At least one engineer must be assigned"),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type AssignTeamInput = z.infer<typeof AssignTeamSchema>;
