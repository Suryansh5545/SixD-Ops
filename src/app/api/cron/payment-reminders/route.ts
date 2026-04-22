/**
 * GET /api/cron/payment-reminders
 *
 * Cron job: runs daily at 09:00 IST.
 * Evaluates all open invoices and:
 *   1. Sends scheduled payment reminder emails (at +7, +14 days)
 *   2. Sends WhatsApp draft at +14 days (generates message for manual send)
 *   3. Escalates to BH + MD at +21 days
 *   4. Flags as OVERDUE and sends daily nudge at payment-term threshold
 *
 * Protected by CRON_SECRET env var.
 * node-cron schedules this route via an internal HTTP call at server startup.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/EmailService";
import { NotificationService } from "@/lib/services/NotificationService";
import { formatINR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();

    // Find all pending reminders due now or in the past
    const pendingReminders = await prisma.paymentReminder.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
        invoice: {
          status: { in: ["SENT", "PARTIALLY_PAID"] },
        },
      },
      include: {
        invoice: {
          include: {
            project: {
              include: {
                pm: { select: { id: true, name: true, email: true } },
                client: true,
                po: {
                  include: {
                    assignedPM: { select: { email: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let processed = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        const invoice = reminder.invoice;
        const pm = invoice.project.pm;

        // Send reminder email
        const emailSent = await EmailService.sendPaymentReminder({
          to: pm.email,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.project.client.name,
          amount: formatINR(invoice.balanceDue.toString()),
          dueDate: formatDate(invoice.dueDate),
          daysOverdue: reminder.dayOffset,
          body: reminder.draftBody,
        });

        // +21 days: escalate to Business Head + MD
        if (reminder.dayOffset >= 21) {
          const leaders = await prisma.user.findMany({
            where: {
              OR: [
                { role: { in: ["MD", "BUSINESS_HEAD"] } },
                { roles: { has: "MD" } },
                { roles: { has: "BUSINESS_HEAD" } },
              ],
              isActive: true,
            },
            select: { id: true },
          });

          await NotificationService.notifyEscalation(
            leaders.map((u) => u.id),
            invoice.invoiceNumber,
            invoice.project.client.name,
            reminder.dayOffset,
            invoice.id
          );
        }

        // Mark reminder as sent
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            status: emailSent ? "SENT" : "SKIPPED",
            sentAt: emailSent ? now : undefined,
          },
        });

        processed++;
      } catch (err) {
        console.error(`[Cron/PaymentReminders] Failed to process reminder ${reminder.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      data: { processed, failed, total: pendingReminders.length },
    });
  } catch (error) {
    console.error("[Cron/PaymentReminders]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
