/**
 * GET    /api/pos/[id] — Get a single PO with full detail
 * PUT    /api/pos/[id] — Update a PO
 * DELETE /api/pos/[id] — Delete a PO (MD only; only if no projects linked)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getPermissionOverrides,
  guardRoute,
  sanitiseText,
} from "@/lib/utils/permissions";
import { UpdatePOSchema } from "@/lib/validations/po";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        assignedPM: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            daysConsumed: true,
            daysAuthorised: true,
            createdAt: true,
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
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ success: false, error: "PO not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: po });
  } catch (error) {
    console.error("[GET /api/pos/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "po:edit",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = UpdatePOSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.notes) data.notes = sanitiseText(data.notes);

    const existing = await prisma.purchaseOrder.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "PO not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id: params.id },
        data: {
          ...(data.clientId ? { clientId: data.clientId } : {}),
          ...(data.documentType ? { documentType: data.documentType } : {}),
          ...(data.referenceNumber ? { referenceNumber: data.referenceNumber } : {}),
          ...(data.amount !== undefined ? { amount: data.amount, remainingValue: data.amount } : {}),
          ...(data.expiryDate ? { expiryDate: new Date(data.expiryDate) } : {}),
          ...(data.expectedWorkingDays ? { expectedWorkingDays: data.expectedWorkingDays } : {}),
          ...(data.paymentTerms ? { paymentTerms: data.paymentTerms } : {}),
          ...(data.customPaymentDays !== undefined ? { customPaymentDays: data.customPaymentDays } : {}),
          ...(data.invoiceType ? { invoiceType: data.invoiceType } : {}),
          ...(data.assignedPMId ? { assignedPMId: data.assignedPMId } : {}),
          ...(data.workStartDate !== undefined ? { workStartDate: data.workStartDate ? new Date(data.workStartDate) : null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
        include: {
          client: true,
          assignedPM: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "PurchaseOrder",
          entityId: po.id,
          action: "UPDATED",
          performedById: session.user.id,
          description: `PO ${po.internalId} updated`,
        },
      });

      return po;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/pos/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "po:delete",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: { _count: { select: { projects: true } } },
    });

    if (!po) {
      return NextResponse.json({ success: false, error: "PO not found" }, { status: 404 });
    }

    if (po._count.projects > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete a PO that has linked projects" },
        { status: 409 }
      );
    }

    await prisma.purchaseOrder.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: "PO deleted" });
  } catch (error) {
    console.error("[DELETE /api/pos/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
