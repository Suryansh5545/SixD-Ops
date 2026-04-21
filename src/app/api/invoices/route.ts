/**
 * GET /api/invoices — List all invoices (paginated, filtered)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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
    const search = searchParams.get("search");
    const skip = (page - 1) * limit;

    const canViewAll = hasPermission(session.user.roles, "invoice:view_all");
    const isEngineer = session.user.roles.includes("FIELD_ENGINEER" as import("@prisma/client").Role);

    if (isEngineer) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const where = {
      ...(status ? { status: status as import("@prisma/client").InvoiceStatus } : {}),
      ...(clientId ? { project: { clientId } } : {}),
      ...(!canViewAll ? { createdById: session.user.id } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" as const } },
              { project: { name: { contains: search, mode: "insensitive" as const } } },
              { project: { client: { name: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          project: {
            include: {
              client: true,
              pm: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
            },
          },
          po: { select: { internalId: true, referenceNumber: true, paymentTerms: true } },
          createdBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          accountsReviewedBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
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
    console.error("[GET /api/invoices]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
