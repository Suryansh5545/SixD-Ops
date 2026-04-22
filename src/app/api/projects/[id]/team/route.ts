/**
 * GET  /api/projects/[id]/team — Get team deployments for a project
 * POST /api/projects/[id]/team — Assign engineers to a project (with availability check)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPermissionOverrides, guardRoute } from "@/lib/utils/permissions";
import { AssignTeamSchema, type AssignTeamInput } from "@/lib/validations/project";
import { NotificationService } from "@/lib/services/NotificationService";

type RouteContext = { params: { id: string } };

const LegacyAssignmentSchema = AssignTeamSchema.shape.engineers.element.extend({
  engineerId: AssignTeamSchema.shape.engineers.element.shape.engineerId.optional(),
  role: AssignTeamSchema.shape.engineers.element.shape.role.optional().default("Field Engineer"),
});

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const deployments = await prisma.deployment.findMany({
      where: { projectId: params.id },
      include: {
        engineer: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          },
        },
        equipment: true,
      },
      orderBy: { startDate: "asc" },
    });

    const engineers = deployments.map((deployment) => ({
      id: deployment.engineer.id,
      deploymentId: deployment.id,
      name: deployment.engineer.user.name,
      email: deployment.engineer.user.email,
      division: deployment.engineer.division,
      level: deployment.engineer.level,
      currentStatus: deployment.engineer.currentStatus,
      role: deployment.role,
      startDate: deployment.startDate,
      endDate: deployment.endDate,
      equipmentId: deployment.equipmentId,
      equipmentName: deployment.equipment?.name ?? null,
    }));

    const equipment = deployments
      .filter((deployment) => deployment.equipment)
      .map((deployment) => ({
        id: deployment.equipment!.id,
        name: deployment.equipment!.name,
        type: deployment.equipment!.division,
        serialNumber: deployment.equipment!.serialNumber,
        deploymentId: deployment.id,
        assignedEngineerId: deployment.engineer.id,
      }));

    return NextResponse.json({
      success: true,
      data: {
        deployments,
        engineers,
        equipment,
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/:id/team]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "planning:assign_team",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = AssignTeamSchema.safeParse(body);
    let engineers: AssignTeamInput["engineers"] | null =
      parsed.success
        ? parsed.data.engineers
        : null;

    if (!engineers) {
      const legacyParsed = LegacyAssignmentSchema.safeParse(body);
      if (legacyParsed.success && legacyParsed.data.engineerId) {
        engineers = [
          {
            engineerId: legacyParsed.data.engineerId,
            role: legacyParsed.data.role,
            startDate: legacyParsed.data.startDate,
            endDate: legacyParsed.data.endDate ?? null,
            equipmentId: legacyParsed.data.equipmentId ?? null,
          },
        ];
      }
    }

    if (!engineers) {
      return NextResponse.json(
        { success: false, error: "Validation failed" },
        { status: 400 }
      );
    }

    // ─── Double-booking check ──────────────────────────────────────────────

    const conflicts: string[] = [];

    for (const assignment of engineers) {
      const startDate = new Date(assignment.startDate);
      const endDate = assignment.endDate ? new Date(assignment.endDate) : null;

      // Check engineer availability
      const conflictingDeployment = await prisma.deployment.findFirst({
        where: {
          engineerId: assignment.engineerId,
          projectId: { not: params.id }, // Ignore current project
          status: { not: "COMPLETED" },
          OR: [
            // Overlaps with existing deployment
            {
              startDate: { lte: endDate ?? new Date("2099-12-31") },
              OR: [
                { endDate: null },
                { endDate: { gte: startDate } },
              ],
            },
          ],
        },
        include: {
          engineer: { include: { user: { select: { name: true } } } },
          project: { select: { name: true } },
        },
      });

      if (conflictingDeployment) {
        conflicts.push(
          `${conflictingDeployment.engineer.user.name} is already deployed to ` +
          `"${conflictingDeployment.project.name}" from ` +
          `${conflictingDeployment.startDate.toISOString().split("T")[0]}` +
          (conflictingDeployment.endDate
            ? ` to ${conflictingDeployment.endDate.toISOString().split("T")[0]}`
            : " (no end date)")
        );
      }

      // Check equipment availability
      if (assignment.equipmentId) {
        const equipmentConflict = await prisma.deployment.findFirst({
          where: {
            equipmentId: assignment.equipmentId,
            projectId: { not: params.id },
            status: { not: "COMPLETED" },
            OR: [
              {
                startDate: { lte: endDate ?? new Date("2099-12-31") },
                OR: [
                  { endDate: null },
                  { endDate: { gte: startDate } },
                ],
              },
            ],
          },
          include: {
            equipment: { select: { name: true } },
            project: { select: { name: true } },
          },
        });

        if (equipmentConflict) {
          conflicts.push(
            `${equipmentConflict.equipment?.name} is already assigned to ` +
            `"${equipmentConflict.project.name}" during this period`
          );
        }
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Scheduling conflicts detected",
          conflicts,
        },
        { status: 409 }
      );
    }

    // ─── Create deployments ────────────────────────────────────────────────

    const deployments = await prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        engineers.map((a) =>
          tx.deployment.create({
            data: {
              projectId: params.id,
              engineerId: a.engineerId,
              role: a.role,
              startDate: new Date(a.startDate),
              endDate: a.endDate ? new Date(a.endDate) : null,
              equipmentId: a.equipmentId ?? null,
              status: "PLANNED",
            },
            include: {
              engineer: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
              equipment: true,
            },
          })
        )
      );

      // Update project status to PLANNING_TEAM
      const project = await tx.project.findUnique({
        where: { id: params.id },
        select: { status: true, name: true, pmId: true, division: true },
      });

      if (project && project.status === "PO_MAPPED") {
        await tx.project.update({
          where: { id: params.id },
          data: { status: "PLANNING_TEAM" },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "Project",
          entityId: params.id,
          action: "TEAM_ASSIGNED",
          performedById: session.user.id,
          newValue: { engineerCount: engineers.length },
          description: `${engineers.length} engineer(s) assigned to project`,
          projectId: params.id,
        },
      });

      return { created, project };
    });

    // Notify division head and business head
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true, division: true },
    });

    if (project) {
      // Find division head(s)
      const divisionHeads = await prisma.engineer.findMany({
        where: {
          level: "HEAD",
          ...(project.division ? { division: project.division } : {}),
        },
        include: { user: { select: { id: true } } },
      });

      for (const head of divisionHeads) {
        await NotificationService.notifyTeamAssigned(head.user.id, project.name, params.id);
      }

      // Notify business heads for travel planning coordination.
      const businessHeads = await prisma.user.findMany({
        where: {
          OR: [{ role: "BUSINESS_HEAD" }, { roles: { has: "BUSINESS_HEAD" } }],
          isActive: true,
        },
        select: { id: true },
      });

      for (const head of businessHeads) {
        await NotificationService.notifyTravelPlanningNeeded(head.id, project.name, params.id);
      }
    }

    return NextResponse.json({ success: true, data: deployments.created }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/:id/team]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
