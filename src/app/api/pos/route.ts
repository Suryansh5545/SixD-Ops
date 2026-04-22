/**
 * GET  /api/pos — List all POs (paginated, with filters)
 * POST /api/pos — Create a new PO
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  generateInternalId,
  getPermissionOverrides,
  guardRoute,
  sanitiseText,
} from "@/lib/utils/permissions";
import { CreatePOSchema } from "@/lib/validations/po";
import { NotificationService } from "@/lib/services/NotificationService";
import { AuditLog } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "po:view_all",
      getPermissionOverrides(session.user)
    );
    // If not view_all, check view_own (BD Team, BMs see their own)
    const canViewAll = !guard;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const clientId = searchParams.get("clientId");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(!canViewAll ? { createdById: session.user.id } : {}),
      ...(status === "ACTIVE"
        ? {
            expiryDate: { gte: new Date() },
            remainingValue: { gt: 0 },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { referenceNumber: { contains: search, mode: "insensitive" as const } },
              { internalId: { contains: search, mode: "insensitive" as const } },
              { client: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          client: true,
          assignedPM: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          createdBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          _count: { select: { projects: true, invoices: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
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
    console.error("[GET /api/pos]", error);
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
      "po:create",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = CreatePOSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Sanitise free-text fields
    if (data.notes) data.notes = sanitiseText(data.notes);

    // Generate sequential internal ID
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    const count = await prisma.purchaseOrder.count({
      where: { createdAt: { gte: yearStart } },
    });
    const internalId = generateInternalId("SXD-PO", count);

    // Create PO with initial remainingValue = amount
    const po = await prisma.purchaseOrder.create({
      data: {
        internalId,
        clientId: data.clientId,
        documentType: data.documentType,
        referenceNumber: data.referenceNumber,
        amount: data.amount,
        remainingValue: data.amount,
        expiryDate: new Date(data.expiryDate),
        expectedWorkingDays: data.expectedWorkingDays,
        paymentTerms: data.paymentTerms,
        customPaymentDays: data.customPaymentDays,
        invoiceType: data.invoiceType,
        assignedPMId: data.assignedPMId,
        workStartDate: data.workStartDate ? new Date(data.workStartDate) : null,
        notes: data.notes,
        createdById: session.user.id,
      },
      include: {
        client: true,
        assignedPM: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: "CREATED",
        performedById: session.user.id,
        newValue: { internalId: po.internalId, amount: po.amount.toString() },
        description: `PO ${po.internalId} created for ${po.client.name}`,
      },
    });

    // Notify assigned PM
    await NotificationService.notifyPOAssigned(
      data.assignedPMId,
      po.internalId,
      po.client.name,
      po.id
    );

    return NextResponse.json({ success: true, data: po }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/pos]", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { success: false, error: "A PO with this reference number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
