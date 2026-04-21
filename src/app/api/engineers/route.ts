import bcrypt from "bcryptjs";
import { DailyStatus, Division, EngineerLevel, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/EmailService";
import { guardRoute } from "@/lib/utils/permissions";

const CreateEngineerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  division: z.nativeEnum(Division),
  level: z.nativeEnum(EngineerLevel),
  password: z.string().min(6).optional(),
  pin: z.string().regex(/^\d{6}$/).optional(),
  isActive: z.boolean().optional(),
});

function isWorkingStatus(status: DailyStatus | null) {
  return status === "WORKING_ON_JOB" || status === "TRAVELLING_TO_SITE";
}

function isStandbyStatus(status: DailyStatus | null) {
  return status === "STANDBY_BLOCKED" || status === "SITE_WAITING";
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const division = searchParams.get("division");
    const availableOnly = searchParams.get("available") === "true";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();

    const comparisonEndDate = endDate ? new Date(endDate) : new Date("2099-12-31");

    const overlappingDeployments =
      startDate
        ? await prisma.deployment.findMany({
            where: {
              status: { not: "COMPLETED" },
              startDate: { lte: comparisonEndDate },
              OR: [{ endDate: null }, { endDate: { gte: new Date(startDate) } }],
            },
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  client: { select: { name: true } },
                },
              },
            },
          })
        : [];

    const unavailableMap = new Map<
      string,
      { projectId: string; projectName: string; clientName: string }
    >();

    for (const deployment of overlappingDeployments) {
      if (!unavailableMap.has(deployment.engineerId)) {
        unavailableMap.set(deployment.engineerId, {
          projectId: deployment.project.id,
          projectName: deployment.project.name,
          clientName: deployment.project.client.name,
        });
      }
    }

    const engineers = await prisma.engineer.findMany({
      where: {
        ...(division ? { division: division as Division } : {}),
        ...(availableOnly && startDate ? { id: { notIn: Array.from(unavailableMap.keys()) } } : {}),
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: "insensitive" } } },
                { user: { email: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            roles: true,
            isActive: true,
          },
        },
        deployments: {
          where: {
            status: { not: "COMPLETED" },
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                client: { select: { name: true } },
              },
            },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
      orderBy: [{ division: "asc" }, { level: "asc" }, { user: { name: "asc" } }],
    });

    const data = engineers.map((engineer) => {
      const currentDeployment = engineer.deployments[0] ?? null;
      const unavailable = unavailableMap.get(engineer.id);

      return {
        id: engineer.id,
        userId: engineer.userId,
        division: engineer.division,
        level: engineer.level,
        currentStatus: engineer.currentStatus,
        currentProjectId: engineer.currentProjectId,
        user: engineer.user,
        currentDeployment,
        isAvailableForDates: startDate ? !unavailable : null,
        isAvailableNow:
          !currentDeployment &&
          !isWorkingStatus(engineer.currentStatus) &&
          !isStandbyStatus(engineer.currentStatus),
        conflictProject: unavailable?.projectName ?? currentDeployment?.project.name ?? null,
        conflictClient:
          unavailable?.clientName ?? currentDeployment?.project.client.name ?? null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/engineers]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "team:manage");
    if (guard) return guard;

    const body = await req.json();
    const parsed = CreateEngineerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const temporaryPassword = data.password ?? "SixD@2024";
    const temporaryPin = data.pin ?? "123456";
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const pinHash = await bcrypt.hash(temporaryPin, 12);

    const engineer = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          pin: pinHash,
          role: Role.FIELD_ENGINEER,
          roles: [Role.FIELD_ENGINEER],
          isActive: data.isActive ?? true,
        },
      });

      const createdEngineer = await tx.engineer.create({
        data: {
          userId: user.id,
          division: data.division,
          level: data.level,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              roles: true,
              isActive: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Engineer",
          entityId: createdEngineer.id,
          action: "CREATED",
          performedById: session.user.id,
          newValue: {
            division: createdEngineer.division,
            level: createdEngineer.level,
            email: createdEngineer.user.email,
          },
          description: `Engineer ${createdEngineer.user.name} created`,
        },
      });

      return createdEngineer;
    });

    if (engineer.user.isActive) {
      const baseUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      await EmailService.sendTeamInvite({
        to: engineer.user.email,
        name: engineer.user.name,
        division: engineer.division,
        level: engineer.level,
        loginUrl: `${baseUrl}/login`,
        invitedBy: session.user.name ?? "SixD Ops",
        temporaryPassword,
        temporaryPin,
      });
    }

    return NextResponse.json({ success: true, data: engineer }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/engineers]", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { success: false, error: "An engineer with this email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
