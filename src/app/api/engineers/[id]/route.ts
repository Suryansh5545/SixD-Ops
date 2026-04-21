import bcrypt from "bcryptjs";
import {
  DailyStatus,
  Division,
  EngineerLevel,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/EmailService";
import { guardRoute } from "@/lib/utils/permissions";

type RouteContext = { params: { id: string } };

const optionalPasswordSchema = z
  .union([z.string().min(6, "Password must be at least 6 characters"), z.literal("")])
  .optional()
  .transform((value) => (value && value.trim() ? value : undefined));

const optionalPinSchema = z
  .union([z.string().regex(/^\d{6}$/, "PIN must be 6 digits"), z.literal("")])
  .optional()
  .transform((value) => (value && value.trim() ? value : undefined));

const UpdateEngineerSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  email: z.string().email("Valid email is required").optional(),
  division: z.nativeEnum(Division).optional(),
  level: z.nativeEnum(EngineerLevel).optional(),
  currentStatus: z.nativeEnum(DailyStatus).nullable().optional(),
  isActive: z.boolean().optional(),
  password: optionalPasswordSchema,
  pin: optionalPinSchema,
  sendInvite: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const engineer = await prisma.engineer.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            roles: true,
            isActive: true,
            createdAt: true,
          },
        },
        deployments: {
          where: {
            status: { in: ["PLANNED", "ACTIVE"] },
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                client: { select: { name: true } },
              },
            },
          },
          orderBy: { startDate: "desc" },
          take: 3,
        },
      },
    });

    if (!engineer) {
      return NextResponse.json({ success: false, error: "Engineer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: engineer });
  } catch (error) {
    console.error("[GET /api/engineers/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "team:manage");
    if (guard) return guard;

    const body = await req.json();
    const parsed = UpdateEngineerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.engineer.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Engineer not found" }, { status: 404 });
    }

    const data = parsed.data;
    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : undefined;
    const pinHash = data.pin ? await bcrypt.hash(data.pin, 12) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (
        data.name !== undefined ||
        data.email !== undefined ||
        data.isActive !== undefined ||
        passwordHash !== undefined ||
        pinHash !== undefined
      ) {
        await tx.user.update({
          where: { id: existing.user.id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
            ...(pinHash !== undefined ? { pin: pinHash } : {}),
          },
        });
      }

      const engineer = await tx.engineer.update({
        where: { id: params.id },
        data: {
          ...(data.division !== undefined ? { division: data.division } : {}),
          ...(data.level !== undefined ? { level: data.level } : {}),
          ...(data.currentStatus !== undefined ? { currentStatus: data.currentStatus } : {}),
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
          entityId: engineer.id,
          action: "UPDATED",
          performedById: session.user.id,
          newValue: {
            name: engineer.user.name,
            email: engineer.user.email,
            division: engineer.division,
            level: engineer.level,
            currentStatus: engineer.currentStatus,
            isActive: engineer.user.isActive,
          },
          description: `Engineer ${engineer.user.name} updated`,
        },
      });

      return engineer;
    });

    if (data.sendInvite && updated.user.isActive) {
      const baseUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      await EmailService.sendTeamInvite({
        to: updated.user.email,
        name: updated.user.name,
        division: updated.division,
        level: updated.level,
        loginUrl: `${baseUrl}/login`,
        invitedBy: session.user.name ?? "SixD Ops",
        temporaryPassword: data.password ?? "Use your existing password",
        temporaryPin: data.pin,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/engineers/:id]", error);

    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { success: false, error: "An engineer with this email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return PATCH(req, context);
}
