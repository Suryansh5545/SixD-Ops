/**
 * GET /api/dashboard?role=md|cfo|bh|pm
 * Returns dashboard statistics for the requesting user's role.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toNumber } from "@/lib/utils/currency";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dashboardType = searchParams.get("type") ?? "pm";

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    switch (dashboardType) {
      case "md":
        return getMDDashboard(now, monthStart, thirtyDaysAgo);
      case "cfo":
        return getCFODashboard(now);
      case "bh":
        return getBHDashboard(now);
      case "pm":
        return getPMDashboard(session.user.id, now);
      default:
        return NextResponse.json({ success: false, error: "Invalid dashboard type" }, { status: 400 });
    }
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function getMDDashboard(now: Date, monthStart: Date, thirtyDaysAgo: Date) {
  const [
    activeProjects,
    invoicedMonth,
    collectedMonth,
    teamStatuses,
    expiringPOs,
    projectStatusBreakdown,
  ] = await Promise.all([
    // Active project count
    prisma.project.count({
      where: {
        status: {
          in: ["ON_SITE_ACTIVE", "ON_SITE_BLOCKED", "MOBILISED_IN_TRANSIT", "PLANNING_TEAM", "PLANNING_TRAVEL"],
        },
      },
    }),

    // Total invoiced this month
    prisma.invoice.aggregate({
      where: { invoiceDate: { gte: monthStart }, status: { not: "DRAFT" } },
      _sum: { totalAmount: true },
    }),

    // Total collected this month
    prisma.payment.aggregate({
      where: { paymentDate: { gte: monthStart } },
      _sum: { amount: true },
    }),

    // Team deployment statuses
    prisma.engineer.findMany({
      select: {
        id: true,
        division: true,
        level: true,
        currentStatus: true,
        currentProjectId: true,
        user: { select: { name: true } },
      },
    }),

    // POs expiring in next 30 days
    prisma.purchaseOrder.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        client: { select: { name: true } },
        assignedPM: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),

    // Project status breakdown
    prisma.project.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  // Overdue receivables: invoices SENT but past due date with balance > 0
  const overdueInvoices = await prisma.invoice.aggregate({
    where: {
      status: { in: ["SENT", "PARTIALLY_PAID"] },
      dueDate: { lt: now },
      balanceDue: { gt: 0 },
    },
    _sum: { balanceDue: true },
  });

  // Engineer utilisation this month
  const engineerUtil = await prisma.logSheetEntry.groupBy({
    by: ["engineerId", "dailyStatus"],
    where: { date: { gte: monthStart } },
    _count: { dailyStatus: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      stats: {
        activeProjects,
        totalInvoicedMonth: toNumber(invoicedMonth._sum.totalAmount?.toString() ?? "0"),
        totalCollectedMonth: toNumber(collectedMonth._sum.amount?.toString() ?? "0"),
        overdueReceivables: toNumber(overdueInvoices._sum.balanceDue?.toString() ?? "0"),
        teamOnSite: teamStatuses.filter((e) =>
          ["WORKING_ON_JOB", "TRAVELLING_TO_SITE"].includes(e.currentStatus ?? "")
        ).length,
        posExpiringIn30Days: expiringPOs.length,
      },
      teamStatuses,
      expiringPOs,
      projectStatusBreakdown,
      engineerUtil,
    },
  });
}

async function getCFODashboard(now: Date) {
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [receivables0to30, receivables31to60, receivables60plus, invoices12Months, payments12Months] = await Promise.all([
    // 0-30 days overdue
    prisma.invoice.aggregate({
      where: {
        status: { in: ["SENT", "PARTIALLY_PAID"] },
        dueDate: { gte: thirtyDaysAgo, lte: now },
      },
      _sum: { balanceDue: true },
    }),
    // 31-60 days
    prisma.invoice.aggregate({
      where: {
        status: { in: ["SENT", "PARTIALLY_PAID"] },
        dueDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      _sum: { balanceDue: true },
    }),
    // 60+ days
    prisma.invoice.aggregate({
      where: {
        status: { in: ["SENT", "PARTIALLY_PAID"] },
        dueDate: { lt: sixtyDaysAgo },
      },
      _sum: { balanceDue: true },
    }),
    // Monthly invoice totals (12 months)
    prisma.$queryRaw<{ month: string; total: number }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "invoiceDate"), 'YYYY-MM') as month,
             SUM("totalAmount")::float as total
      FROM "Invoice"
      WHERE "invoiceDate" >= NOW() - INTERVAL '12 months'
        AND status != 'DRAFT'
      GROUP BY month
      ORDER BY month ASC
    `,
    // Monthly collection totals (12 months)
    prisma.$queryRaw<{ month: string; total: number }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "paymentDate"), 'YYYY-MM') as month,
             SUM(amount)::float as total
      FROM "Payment"
      WHERE "paymentDate" >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `,
  ]);

  return NextResponse.json({
    success: true,
    data: {
      receivablesAgeing: {
        bucket0to30: toNumber(receivables0to30._sum.balanceDue?.toString() ?? "0"),
        bucket31to60: toNumber(receivables31to60._sum.balanceDue?.toString() ?? "0"),
        bucket60plus: toNumber(receivables60plus._sum.balanceDue?.toString() ?? "0"),
      },
      monthlyInvoiced: invoices12Months,
      monthlyCollected: payments12Months,
    },
  });
}

async function getBHDashboard(now: Date) {
  const [poRegister, revenueByClient, revenueByIndustry] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: {
        client: { select: { name: true, sector: true } },
        assignedPM: { select: { name: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.$queryRaw<{ clientName: string; total: number }[]>`
      SELECT c.name as "clientName", SUM(i."totalAmount")::float as total
      FROM "Invoice" i
      JOIN "Project" p ON i."projectId" = p.id
      JOIN "Client" c ON p."clientId" = c.id
      WHERE i.status != 'DRAFT'
      GROUP BY c.name
      ORDER BY total DESC
      LIMIT 10
    `,
    prisma.$queryRaw<{ sector: string; total: number }[]>`
      SELECT c.sector, SUM(i."totalAmount")::float as total
      FROM "Invoice" i
      JOIN "Project" p ON i."projectId" = p.id
      JOIN "Client" c ON p."clientId" = c.id
      WHERE i.status != 'DRAFT'
      GROUP BY c.sector
      ORDER BY total DESC
    `,
  ]);

  return NextResponse.json({
    success: true,
    data: { poRegister, revenueByClient, revenueByIndustry },
  });
}

async function getPMDashboard(userId: string, now: Date) {
  const [myProjects, pendingExpenses, invoicesToRaise, overdueReceivables] = await Promise.all([
    // PM's projects
    prisma.project.findMany({
      where: { pmId: userId },
      include: {
        client: { select: { name: true } },
        po: { select: { internalId: true, expiryDate: true, expectedWorkingDays: true } },
        _count: { select: { expenseClaims: true, invoices: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),

    // Projects with pending expense approval
    prisma.project.findMany({
      where: {
        pmId: userId,
        expenseClaims: {
          some: { approvedByPM: false, rejectedByPM: false },
        },
      },
      include: {
        _count: {
          select: {
            expenseClaims: {
              where: { approvedByPM: false, rejectedByPM: false },
            },
          },
        },
      },
    }),

    // Projects completed but no invoice
    prisma.project.findMany({
      where: {
        pmId: userId,
        status: { in: ["WORK_COMPLETED", "MOM_CREATED", "REPORT_SUBMITTED", "EXPENSES_RECEIVED"] },
        invoices: { none: {} },
      },
      include: { client: { select: { name: true } } },
    }),

    // Overdue invoices for PM's projects
    prisma.invoice.findMany({
      where: {
        project: { pmId: userId },
        status: { in: ["SENT", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
      },
      include: {
        project: { include: { client: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      myProjects,
      pendingExpenses,
      invoicesToRaise,
      overdueReceivables,
    },
  });
}
