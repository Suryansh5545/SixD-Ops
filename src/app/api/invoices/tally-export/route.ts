import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { TallyExportService } from "@/lib/services/TallyExportService";
import type { InvoiceWithRelations } from "@/lib/services/TallyExportService";
import { format } from "date-fns";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    assertPermission(session.user.roles, "invoice:view_all");

    const url = new URL(req.url);
    const ids = url.searchParams.get("ids");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");

    const whereClause: Record<string, unknown> = {
      status: { in: ["APPROVED", "SENT", "PARTIALLY_PAID", "PAID"] },
    };

    if (ids) {
      whereClause.id = { in: ids.split(",") };
    }

    if (fromDate || toDate) {
      whereClause.issuedAt = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        lineItems: true,
        project: {
          include: {
            po: {
              include: {
                client: true,
              },
            },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: "No invoices found for export" }, { status: 404 });
    }

    const csv = TallyExportService.generateCSV(invoices as unknown as InvoiceWithRelations[]);

    const filename = `tally-export-${format(new Date(), "yyyy-MM-dd")}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Tally Export]", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
