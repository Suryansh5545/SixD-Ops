/**
 * POST /api/invoices/[id]/payments — Record a payment against an invoice
 * GET  /api/invoices/[id]/payments — List payments for an invoice
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { guardRoute } from "@/lib/utils/permissions";
import { RecordPaymentSchema } from "@/lib/validations/invoice";
import { NotificationService } from "@/lib/services/NotificationService";
import { formatINR, toNumber } from "@/lib/utils/currency";
import { sanitiseText } from "@/lib/utils/permissions";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      where: { invoiceId: params.id },
      include: {
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: "desc" },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    console.error("[GET /api/invoices/:id/payments]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "payment:record");
    if (guard) return guard;

    const body = await req.json();
    const parsed = RecordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.notes) data.notes = sanitiseText(data.notes);

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        project: {
          include: {
            pm: { select: { id: true } },
            client: true,
            po: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { success: false, error: "Invoice is already fully paid" },
        { status: 409 }
      );
    }

    const currentBalance = toNumber(invoice.balanceDue.toString());
    const paymentAmount = data.amount;

    if (paymentAmount > currentBalance + 0.01) {
      return NextResponse.json(
        { success: false, error: `Payment amount exceeds balance due (₹${currentBalance.toFixed(2)})` },
        { status: 400 }
      );
    }

    const newBalance = Math.max(0, currentBalance - paymentAmount);
    const isFullyPaid = newBalance < 0.01;

    const result = await prisma.$transaction(async (tx) => {
      // Record payment
      const payment = await tx.payment.create({
        data: {
          invoiceId: params.id,
          amount: paymentAmount,
          paymentDate: new Date(data.paymentDate),
          referenceNumber: data.referenceNumber,
          isPartial: !isFullyPaid,
          balanceAfter: newBalance,
          notes: data.notes,
          recordedById: session.user.id,
        },
      });

      // Update invoice
      const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID";
      await tx.invoice.update({
        where: { id: params.id },
        data: {
          balanceDue: newBalance,
          status: newStatus,
        },
      });

      // Update project status
      await tx.project.update({
        where: { id: invoice.projectId },
        data: { status: isFullyPaid ? "PAYMENT_RECEIVED" : "PARTIALLY_PAID" },
      });

      // Update PO remainingValue
      await tx.purchaseOrder.update({
        where: { id: invoice.poId },
        data: {
          remainingValue: {
            decrement: paymentAmount,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Invoice",
          entityId: params.id,
          action: "PAYMENT_RECORDED",
          performedById: session.user.id,
          newValue: { amount: paymentAmount, balance: newBalance },
          description: `Payment of ${formatINR(paymentAmount)} recorded. Balance: ${formatINR(newBalance)}`,
          projectId: invoice.projectId,
        },
      });

      return payment;
    });

    // Notify PM
    await NotificationService.notifyPaymentReceived(
      invoice.project.pm.id,
      invoice.invoiceNumber,
      formatINR(paymentAmount),
      params.id
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/invoices/:id/payments]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
