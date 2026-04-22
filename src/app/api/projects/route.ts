/**
 * GET  /api/projects — List projects (paginated, filtered by role)
 * POST /api/projects — Create a new project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getPermissionOverrides,
  guardRoute,
  sanitiseText,
} from "@/lib/utils/permissions";
import { CreateProjectSchema } from "@/lib/validations/project";
import { hasPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const pmId = searchParams.get("pmId");
    const search = searchParams.get("search");
    const skip = (page - 1) * limit;

    const overrides = getPermissionOverrides(session.user);
    const canViewAll = hasPermission(session.user.roles, "project:view_all", overrides);
    const canViewOwn = hasPermission(session.user.roles, "project:view_own", overrides);

    // Engineers only see projects they're deployed to
    const isFieldEngineer = session.user.roles.includes("FIELD_ENGINEER" as import("@prisma/client").Role);

    const where = {
      ...(status ? { status: status as import("@prisma/client").ProjectStatus } : {}),
      ...(clientId ? { clientId } : {}),
      ...(pmId ? { pmId } : {}),
      // Business managers see only their projects; engineers see deployed projects.
      ...(!canViewAll && canViewOwn ? { pmId: session.user.id } : {}),
      ...(isFieldEngineer
        ? {
            deployments: {
              some: {
                engineer: { userId: session.user.id },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { client: { name: { contains: search, mode: "insensitive" as const } } },
              { po: { referenceNumber: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          client: true,
          pm: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          po: {
            include: {
              client: true,
              assignedPM: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
            },
          },
          _count: {
            select: {
              deployments: true,
              logSheetEntries: true,
              expenseClaims: true,
              invoices: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "project:create",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.description) data.description = sanitiseText(data.description);

    // Verify the PO exists and has remaining value
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.poId },
      include: { client: true },
    });

    if (!po) {
      return NextResponse.json({ success: false, error: "PO not found" }, { status: 404 });
    }

    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          poId: data.poId,
          clientId: data.clientId,
          name: data.name,
          description: data.description,
          division: data.division,
          pmId: data.pmId,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          daysAuthorised: data.daysAuthorised,
          siteLocation: data.siteLocation,
          status: "PO_RECEIVED",
        },
        include: {
          client: true,
          pm: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          po: true,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Project",
          entityId: proj.id,
          action: "CREATED",
          performedById: session.user.id,
          newValue: { name: proj.name, status: proj.status },
          description: `Project "${proj.name}" created`,
          projectId: proj.id,
        },
      });

      return proj;
    });

    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
