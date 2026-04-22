/**
 * GET /api/cron/compliance-expiry
 *
 * Cron job: runs daily at 08:00 IST.
 * Sends compliance expiry alerts at 30 days and 7 days before expiry.
 * Also updates document status in the database.
 *
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/EmailService";
import { NotificationService } from "@/lib/services/NotificationService";
import { computeComplianceStatus, daysUntilExpiry, formatDate } from "@/lib/utils/date";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Find all docs expiring within 30 days (not already EXPIRED)
    const expiringDocs = await prisma.complianceDocument.findMany({
      where: {
        expiryDate: { lte: thirtyDaysFromNow },
        status: { not: "EXPIRED" },
      },
      include: {
        client: true,
        docType: true,
      },
    });

    let alertsSent = 0;

    for (const doc of expiringDocs) {
      const days = daysUntilExpiry(doc.expiryDate);
      const newStatus = computeComplianceStatus(doc.expiryDate);

      // Update status
      if (newStatus !== doc.status) {
        await prisma.complianceDocument.update({
          where: { id: doc.id },
          data: { status: newStatus },
        });
      }

      // Send alerts at 30 and 7 days only (not every day)
      const shouldAlert = days === 30 || days === 7 || days === 0;
      if (!shouldAlert) continue;

      // Find BMs for this client + MD
      const md = await prisma.user.findMany({
        where: {
          OR: [{ role: "MD" }, { roles: { has: "MD" } }],
          isActive: true,
        },
        select: { id: true, email: true },
      });

      const bms = await prisma.user.findMany({
        where: {
          OR: [{ role: "BUSINESS_MANAGER" }, { roles: { has: "BUSINESS_MANAGER" } }],
          isActive: true,
        },
        select: { id: true, email: true },
      });

      const recipients = [...md, ...bms];
      const recipientEmails = recipients.map((u) => u.email).filter(Boolean) as string[];
      const recipientIds = recipients.map((u) => u.id);

      // Email
      await EmailService.sendComplianceAlert({
        to: recipientEmails,
        docTypeName: doc.docType.name,
        clientName: doc.client.name,
        expiryDate: formatDate(doc.expiryDate),
        daysUntilExpiry: days,
      });

      // In-app notification
      await NotificationService.notifyComplianceExpiring(
        recipientIds,
        doc.docType.name,
        doc.client.name,
        days
      );

      alertsSent++;
    }

    // Also handle PO expiry alerts (30, 15, 7 days)
    await checkPOExpiry();

    return NextResponse.json({
      success: true,
      data: { expiringDocs: expiringDocs.length, alertsSent },
    });
  } catch (error) {
    console.error("[Cron/ComplianceExpiry]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function checkPOExpiry() {
  const now = new Date();
  const thresholds = [7, 15, 30];

  for (const days of thresholds) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStart = new Date(targetDate);
    targetDateStart.setUTCHours(0, 0, 0, 0);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setUTCHours(23, 59, 59, 999);

    const expiringPOs = await prisma.purchaseOrder.findMany({
      where: {
        expiryDate: {
          gte: targetDateStart,
          lte: targetDateEnd,
        },
      },
      include: {
        client: true,
        assignedPM: { select: { id: true } },
      },
    });

    for (const po of expiringPOs) {
      // Notify the assigned business manager and business head
      const bh = await prisma.user.findMany({
        where: {
          OR: [{ role: "BUSINESS_HEAD" }, { roles: { has: "BUSINESS_HEAD" } }],
          isActive: true,
        },
        select: { id: true },
      });

      const userIds = [po.assignedPM.id, ...bh.map((u) => u.id)];

      await NotificationService.notifyPOExpiring(
        userIds,
        po.internalId,
        po.client.name,
        days,
        po.id
      );
    }
  }
}
