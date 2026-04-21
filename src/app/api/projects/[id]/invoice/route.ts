/**
 * GET  /api/projects/[id]/invoice — Get invoices for a project
 * POST /api/projects/[id]/invoice — Initiate an invoice draft
 *
 * Invoice auto-populates from:
 *   - daysConsumed × daily rate (PO amount / expectedWorkingDays) — PM can edit
 *   - Extra hours from log sheets
 *   - Standby hours
 *   - All approved expense claims
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { guardRoute } from "@/lib/utils/permissions";
import { generateInternalId } from "@/lib/utils/permissions";
import { calcDailyRate, calcGST, toNumber } from "@/lib/utils/currency";
import { NotificationService } from "@/lib/services/NotificationService";
import type { InvoiceLineItem } from "@/types";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { projectId: params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        accountsReviewedBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        payments: { orderBy: { paymentDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error("[GET /api/projects/:id/invoice]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "invoice:initiate");
    if (guard) return guard;

    // Verify project exists and is at correct status
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        po: true,
        client: true,
        logSheetEntries: {
          where: { dailyStatus: "WORKING_ON_JOB", clockOut: { not: null } },
        },
        expenseClaims: {
          where: { approvedByPM: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const INVOICE_ELIGIBLE_STATUSES = [
      "WORK_COMPLETED", "MOM_CREATED", "REPORT_SUBMITTED", "EXPENSES_RECEIVED",
    ];

    if (!INVOICE_ELIGIBLE_STATUSES.includes(project.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot initiate invoice: project must be at 'Work Completed' or later (current: ${project.status})`,
        },
        { status: 400 }
      );
    }

    // ─── Compliance Gate ────────────────────────────────────────────────────

    const mandatoryDocs = await prisma.clientComplianceRequirement.findMany({
      where: { clientId: project.clientId, isMandatory: true },
      include: { docType: true },
    });

    const now = new Date();
    const missingOrExpired: string[] = [];

    for (const req of mandatoryDocs) {
      const doc = await prisma.complianceDocument.findFirst({
        where: {
          clientId: project.clientId,
          docTypeId: req.docTypeId,
          expiryDate: { gte: now },
          status: { not: "EXPIRED" },
        },
      });

      if (!doc) {
        missingOrExpired.push(req.docType.name);
      }
    }

    if (missingOrExpired.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Compliance Gate: Cannot initiate invoice — missing or expired documents",
          missingDocs: missingOrExpired,
        },
        { status: 422 }
      );
    }

    // ─── Auto-populate line items ────────────────────────────────────────────

    const poAmount = toNumber(project.po.amount.toString());
    const dailyRate = calcDailyRate(poAmount, project.po.expectedWorkingDays);
    const gstPercent = project.client.gstPercent;

    const lineItems: InvoiceLineItem[] = [];

    // 1. Professional fees
    if (project.daysConsumed > 0 && dailyRate > 0) {
      lineItems.push({
        description: `Professional Fees — ${project.daysConsumed} day(s) at ₹${dailyRate.toLocaleString("en-IN")}/day`,
        quantity: project.daysConsumed,
        rate: dailyRate,
        amount: project.daysConsumed * dailyRate,
        type: "PROFESSIONAL_FEES",
      });
    }

    // 2. Extra hours from log sheet
    const totalExtraHours = project.logSheetEntries.reduce(
      (sum, e) => sum + (e.extraHours ?? 0),
      0
    );
    if (totalExtraHours > 0) {
      const extraHourRate = dailyRate / 8; // Per-hour rate = daily / standard shift
      lineItems.push({
        description: `Extra Hours — ${totalExtraHours.toFixed(2)} hour(s)`,
        quantity: Math.round(totalExtraHours * 100) / 100,
        rate: Math.round(extraHourRate * 100) / 100,
        amount: Math.round(totalExtraHours * extraHourRate * 100) / 100,
        type: "EXTRA_HOURS",
      });
    }

    // 3. Standby/waiting charges
    if (project.standbyHoursTotal > 0) {
      const standbyRate = dailyRate / 8; // Same as extra hours rate
      lineItems.push({
        description: `Standby / Waiting Charges — ${project.standbyHoursTotal.toFixed(2)} hour(s)`,
        quantity: Math.round(project.standbyHoursTotal * 100) / 100,
        rate: Math.round(standbyRate * 100) / 100,
        amount: Math.round(project.standbyHoursTotal * standbyRate * 100) / 100,
        type: "STANDBY_CHARGES",
      });
    }

    // 4. Approved expense claims
    for (const expense of project.expenseClaims) {
      const expenseAmount = toNumber(expense.amount.toString());
      lineItems.push({
        description: expense.description ?? expense.category.replace(/_/g, " "),
        quantity: 1,
        rate: expenseAmount,
        amount: expenseAmount,
        type: mapExpenseToLineType(expense.category),
      });
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = calcGST(subtotal, gstPercent);
    const totalAmount = subtotal + gstAmount;

    // Generate invoice number
    const yearStart = new Date(`${new Date().getFullYear()}-01-01`);
    const invoiceCount = await prisma.invoice.count({
      where: { createdAt: { gte: yearStart } },
    });
    const invoiceNumber = generateInternalId("SXD-INV", invoiceCount);

    // Calculate due date based on payment terms
    const today = new Date();
    const paymentDays =
      project.po.paymentTerms === "NET_30"
        ? 30
        : project.po.paymentTerms === "NET_45"
        ? 45
        : (project.po.customPaymentDays ?? 30);

    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + paymentDays);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          projectId: params.id,
          poId: project.poId,
          invoiceDate: today,
          lineItems: lineItems as object[],
          subtotal,
          gstPercent,
          gstAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: "DRAFT",
          dueDate,
          createdById: session.user.id,
        },
        include: {
          project: { include: { client: true, po: true } },
          createdBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        },
      });

      // Advance project status
      await tx.project.update({
        where: { id: params.id },
        data: { status: "INVOICE_INITIATED" },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Invoice",
          entityId: inv.id,
          action: "CREATED",
          performedById: session.user.id,
          newValue: { invoiceNumber, totalAmount },
          description: `Invoice ${invoiceNumber} created (draft)`,
          projectId: params.id,
        },
      });

      return inv;
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/:id/invoice]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function mapExpenseToLineType(category: string): InvoiceLineItem["type"] {
  const map: Record<string, InvoiceLineItem["type"]> = {
    TRAVEL_FLIGHT: "TRAVEL",
    TRAVEL_TRAIN: "TRAVEL",
    TRAVEL_CAB: "TRAVEL",
    HOTEL: "TRAVEL",
    DAILY_ALLOWANCE: "DAILY_ALLOWANCE",
    EQUIPMENT_MOBILISATION: "EQUIPMENT_MOBILISATION",
    STANDBY_CHARGES: "STANDBY_CHARGES",
    EXTRA_HOURS: "EXTRA_HOURS",
    MISCELLANEOUS: "MISCELLANEOUS",
  };
  return map[category] ?? "MISCELLANEOUS";
}
