/**
 * GET   /api/invoices/[id] — Invoice detail
 * PUT   /api/invoices/[id] — Update invoice (line items, status)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { guardRoute } from "@/lib/utils/permissions";
import { UpdateInvoiceSchema, UpdateInvoiceStatusSchema } from "@/lib/validations/invoice";
import { NotificationService } from "@/lib/services/NotificationService";
import { calcGST, toNumber } from "@/lib/utils/currency";
import { formatINR } from "@/lib/utils/currency";
import type { InvoiceLineItem } from "@/types";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        project: {
          include: {
            client: true,
            pm: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
            po: true,
          },
        },
        po: true,
        createdBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        accountsReviewedBy: { select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } },
        payments: {
          include: {
            recordedBy: { select: { id: true, name: true } },
          },
          orderBy: { paymentDate: "desc" },
        },
        reminders: { orderBy: { scheduledAt: "asc" } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error("[GET /api/invoices/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();

    // Determine if this is a status update or a content update
    if ("status" in body) {
      return handleStatusUpdate(req, params.id, session.user.id, session.user.roles as import("@prisma/client").Role[], body);
    }

    // Content update — PM editing draft
    const guard = guardRoute(session.user.roles, "invoice:edit");
    if (guard) return guard;

    const parsed = UpdateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    if (!["DRAFT", "UNDER_REVIEW"].includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: "Cannot edit an invoice that is already approved or sent" },
        { status: 409 }
      );
    }

    // Recalculate totals if line items changed
    let subtotal = toNumber(existing.subtotal.toString());
    let gstPercent = existing.gstPercent;

    if (data.lineItems) {
      subtotal = data.lineItems.reduce((sum, item) => sum + item.amount, 0);
    }
    if (data.gstPercent !== undefined) {
      gstPercent = data.gstPercent;
    }

    const gstAmount = calcGST(subtotal, gstPercent);
    const totalAmount = subtotal + gstAmount;

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: params.id },
        data: {
          ...(data.invoiceDate ? { invoiceDate: new Date(data.invoiceDate) } : {}),
          ...(data.lineItems ? { lineItems: data.lineItems as object[] } : {}),
          ...(data.gstPercent !== undefined ? { gstPercent, gstAmount, totalAmount, subtotal, balanceDue: totalAmount } : {}),
          ...(data.workingSheetUrl !== undefined ? { workingSheetUrl: data.workingSheetUrl } : {}),
          ...(data.reviewNotes !== undefined ? { reviewNotes: data.reviewNotes } : {}),
          ...(data.lineItems ? { subtotal, gstAmount, totalAmount, balanceDue: totalAmount } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Invoice",
          entityId: params.id,
          action: "UPDATED",
          performedById: session.user.id,
          description: "Invoice updated",
          projectId: existing.projectId,
        },
      });

      return inv;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PUT /api/invoices/:id]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return PUT(req, context);
}

// ─── STATUS UPDATE HANDLER ────────────────────────────────────────────────────

async function handleStatusUpdate(
  _req: NextRequest,
  invoiceId: string,
  userId: string,
  userRoles: import("@prisma/client").Role[],
  body: unknown
) {
  const parsed = UpdateInvoiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, sentMethod, reviewNotes } = parsed.data;

  // Permission checks per status transition
  const statusPermissions: Record<string, import("@/lib/rbac").Permission> = {
    UNDER_REVIEW: "invoice:initiate",   // PM submits for review
    APPROVED: "invoice:approve",         // Accounts approves
    SENT: "invoice:send",                // Accounts marks as sent
  };

  const requiredPermission = statusPermissions[status];
  if (requiredPermission) {
    const { guardRoute } = await import("@/lib/utils/permissions");
    const guard = guardRoute(userRoles, requiredPermission);
    if (guard) return guard;
  }

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      project: {
        include: {
          pm: { select: { id: true } },
          client: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        ...(sentMethod ? { sentMethod, sentDate: new Date() } : {}),
        ...(reviewNotes !== undefined ? { reviewNotes } : {}),
        ...(status === "APPROVED" ? { accountsReviewedById: userId } : {}),
      },
    });

    // Update project status in sync
    const projectStatusMap: Record<string, import("@prisma/client").ProjectStatus | null> = {
      UNDER_REVIEW: "INVOICE_UNDER_REVIEW",
      APPROVED: null, // stays at INVOICE_UNDER_REVIEW until sent
      SENT: "INVOICE_SENT",
      PARTIALLY_PAID: "PARTIALLY_PAID",
      PAID: "PAYMENT_RECEIVED",
    };

    const projStatus = projectStatusMap[status];
    if (projStatus) {
      await tx.project.update({
        where: { id: existing.projectId },
        data: { status: projStatus },
      });
    }

    await tx.auditLog.create({
      data: {
        entityType: "Invoice",
        entityId: invoiceId,
        action: "STATUS_CHANGED",
        performedById: userId,
        oldValue: { status: existing.status },
        newValue: { status },
        description: `Invoice status changed to ${status}`,
        projectId: existing.projectId,
      },
    });

    return inv;
  });

  // Schedule payment reminders when invoice is SENT
  if (status === "SENT") {
    await schedulePaymentReminders(invoiceId, existing.projectId);
  }

  // Notify PM on approval
  if (status === "APPROVED") {
    await NotificationService.notifyInvoiceApproved(
      existing.project.pm.id,
      existing.invoiceNumber,
      invoiceId
    );
  }

  // Notify accounts on submission for review
  if (status === "UNDER_REVIEW") {
    const accountsUsers = await prisma.user.findMany({
      where: { role: "ACCOUNTS", isActive: true },
      select: { id: true },
    });
    await NotificationService.notifyInvoiceReadyForReview(
      accountsUsers.map((u) => u.id),
      existing.invoiceNumber,
      invoiceId
    );
  }

  return NextResponse.json({ success: true, data: updated });
}

// ─── SCHEDULE PAYMENT REMINDERS ───────────────────────────────────────────────

async function schedulePaymentReminders(invoiceId: string, projectId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      project: {
        include: {
          client: true,
          po: true,
        },
      },
    },
  });

  if (!invoice || !invoice.sentDate) return;

  const sentDate = invoice.sentDate;
  const paymentTermDays =
    invoice.project.po.paymentTerms === "NET_30"
      ? 30
      : invoice.project.po.paymentTerms === "NET_45"
      ? 45
      : (invoice.project.po.customPaymentDays ?? 30);

  const reminderOffsets = [7, 14, 21, paymentTermDays];

  const reminders = reminderOffsets.map((days) => {
    const scheduledAt = new Date(sentDate);
    scheduledAt.setDate(scheduledAt.getDate() + days);

    const isOverdue = days >= paymentTermDays;

    return {
      invoiceId,
      scheduledAt,
      channel: "EMAIL" as const,
      dayOffset: days,
      status: "PENDING" as const,
      draftBody: isOverdue
        ? `OVERDUE NOTICE: Invoice ${invoice.invoiceNumber} for ₹${formatINR(invoice.totalAmount.toString())} from ${invoice.project.client.name} is now overdue (${days} days since dispatch). Please process payment immediately.`
        : `Friendly reminder: Invoice ${invoice.invoiceNumber} for ₹${formatINR(invoice.totalAmount.toString())} from ${invoice.project.client.name} is due. If already processed, please ignore.`,
    };
  });

  await prisma.paymentReminder.createMany({ data: reminders });
}
