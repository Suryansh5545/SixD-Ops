/**
 * GET    /api/projects/[id] — Full project detail
 * PUT    /api/projects/[id] — Update project (status, fields)
 * DELETE /api/projects/[id] — Delete project (MD only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { guardRoute, sanitiseText } from "@/lib/utils/permissions";
import { UpdateProjectSchema } from "@/lib/validations/project";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        client: {
          include: {
            complianceChecklists: {
              include: { docType: true },
            },
          },
        },
        pm: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        po: {
          include: {
            client: true,
            assignedPM: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          },
        },
        deployments: {
          include: {
            engineer: {
              include: {
                user: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
              },
            },
            equipment: true,
          },
          orderBy: { startDate: "asc" },
        },
        logSheetEntries: {
          include: {
            engineer: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 50, // Latest 50 for project detail view
        },
        expenseClaims: {
          include: {
            engineer: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            invoiceDate: true,
            sentDate: true,
            balanceDue: true,
          },
          orderBy: { createdAt: "desc" },
        },
        moms: {
          include: {
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
        reports: {
          include: {
            submittedBy: { select: { id: true, name: true } },
          },
          orderBy: { submissionDate: "desc" },
        },
        documents: {
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          include: {
            performedBy: { select: { id: true, name: true } },
          },
          orderBy: { timestamp: "desc" },
          take: 30,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error("[GET /api/projects/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "project:manage");
    if (guard) return guard;

    const body = await req.json();
    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.description) data.description = sanitiseText(data.description);

    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Handle status change: if moving to ON_SITE_BLOCKED, set blockedSince
      const blockedSince =
        data.status === "ON_SITE_BLOCKED" && existing.status !== "ON_SITE_BLOCKED"
          ? new Date()
          : data.status !== "ON_SITE_BLOCKED"
          ? null
          : existing.blockedSince;

      const isBlocked = data.status === "ON_SITE_BLOCKED";

      const proj = await tx.project.update({
        where: { id: params.id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.division !== undefined ? { division: data.division } : {}),
          ...(data.pmId ? { pmId: data.pmId } : {}),
          ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
          ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
          ...(data.daysAuthorised ? { daysAuthorised: data.daysAuthorised } : {}),
          ...(data.siteLocation !== undefined ? { siteLocation: data.siteLocation } : {}),
          ...(data.status ? { status: data.status, isBlocked, blockedSince } : {}),
        },
        include: {
          client: true,
          pm: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        },
      });

      if (data.status && data.status !== existing.status) {
        await tx.auditLog.create({
          data: {
            entityType: "Project",
            entityId: proj.id,
            action: "STATUS_CHANGED",
            performedById: session.user.id,
            oldValue: { status: existing.status },
            newValue: { status: data.status },
            description: `Status changed from ${existing.status} to ${data.status}`,
            projectId: proj.id,
          },
        });
      }

      return proj;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/projects/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "po:delete"); // MD only
    if (guard) return guard;

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    if (project._count.invoices > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete a project with invoices" },
        { status: 409 }
      );
    }

    await prisma.project.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: "Project deleted" });
  } catch (error) {
    console.error("[DELETE /api/projects/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
