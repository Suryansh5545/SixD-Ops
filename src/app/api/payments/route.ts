import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPermissionOverrides, guardRoute } from "@/lib/utils/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "payment:view",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const invoiceSearch =
      search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" as const } },
              { project: { name: { contains: search, mode: "insensitive" as const } } },
              { project: { client: { name: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {};

    const paymentSearch =
      search
        ? {
            OR: [
              { referenceNumber: { contains: search, mode: "insensitive" as const } },
              { invoice: { invoiceNumber: { contains: search, mode: "insensitive" as const } } },
              { invoice: { project: { name: { contains: search, mode: "insensitive" as const } } } },
              { invoice: { project: { client: { name: { contains: search, mode: "insensitive" as const } } } } },
            ],
          }
        : {};

    const [recentPayments, outstandingInvoices, receivedThisMonth, overdueInvoices] = await Promise.all([
      prisma.payment.findMany({
        where: paymentSearch,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  client: { select: { name: true } },
                },
              },
            },
          },
          recordedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.invoice.findMany({
        where: {
          balanceDue: { gt: 0 },
          ...invoiceSearch,
        },
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          invoiceDate: true,
          totalAmount: true,
          balanceDue: true,
          status: true,
          project: {
            select: {
              id: true,
              name: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: currentMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          balanceDue: { gt: 0 },
          dueDate: { lt: new Date() },
          ...invoiceSearch,
        },
      }),
    ]);

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.balanceDue ?? 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        recentPayments,
        outstandingInvoices,
        summary: {
          overdueInvoices,
          outstandingInvoices: outstandingInvoices.length,
          receivedThisMonth: Number(receivedThisMonth._sum.amount ?? 0),
          totalOutstanding,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/payments]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
