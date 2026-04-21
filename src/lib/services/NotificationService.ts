/**
 * NotificationService — In-app notification creation.
 *
 * Creates records in the Notification table.
 * The frontend polls /api/notifications to display the bell badge.
 *
 * All notification creation is centralised here so the format stays consistent.
 */

import { prisma } from "@/lib/prisma";

interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  link?: string;
}

class NotificationServiceClass {
  /**
   * Creates a single in-app notification for a user.
   */
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          body: input.body,
          link: input.link,
        },
      });
    } catch (error) {
      console.error("[NotificationService] Failed to create notification:", error);
    }
  }

  /**
   * Creates notifications for multiple users at once.
   */
  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    try {
      await prisma.notification.createMany({
        data: inputs.map((n) => ({
          userId: n.userId,
          title: n.title,
          body: n.body,
          link: n.link,
        })),
      });
    } catch (error) {
      console.error("[NotificationService] Failed to create notifications:", error);
    }
  }

  // ─── DOMAIN-SPECIFIC NOTIFICATION HELPERS ───────────────────────────────

  async notifyPOAssigned(pmUserId: string, poInternalId: string, clientName: string, poId: string) {
    await this.create({
      userId: pmUserId,
      title: "New PO Assigned to You",
      body: `PO ${poInternalId} from ${clientName} has been assigned to you.`,
      link: `/pos/${poId}`,
    });
  }

  async notifyTeamAssigned(divisionHeadUserId: string, projectName: string, projectId: string) {
    await this.create({
      userId: divisionHeadUserId,
      title: "Team Assigned to Project",
      body: `Your team has been assigned to project "${projectName}". Please review.`,
      link: `/projects/${projectId}/planning`,
    });
  }

  async notifyTravelPlanningNeeded(adminCoordinatorUserId: string, projectName: string, projectId: string) {
    await this.create({
      userId: adminCoordinatorUserId,
      title: "Travel Planning Required",
      body: `Team assigned to "${projectName}". Please arrange travel and accommodation.`,
      link: `/projects/${projectId}/planning`,
    });
  }

  async notifyExpenseSubmitted(pmUserId: string, engineerName: string, projectName: string, projectId: string) {
    await this.create({
      userId: pmUserId,
      title: "Expense Claim Submitted",
      body: `${engineerName} submitted an expense claim for project "${projectName}".`,
      link: `/projects/${projectId}/expenses`,
    });
  }

  async notifyExpenseApproved(engineerUserId: string, projectName: string) {
    await this.create({
      userId: engineerUserId,
      title: "Expense Claim Approved",
      body: `Your expense claim for project "${projectName}" has been approved.`,
    });
  }

  async notifyExpenseRejected(engineerUserId: string, projectName: string, reason: string) {
    await this.create({
      userId: engineerUserId,
      title: "Expense Claim Rejected",
      body: `Your expense claim for project "${projectName}" was rejected. Reason: ${reason}`,
    });
  }

  async notifyInvoiceReadyForReview(accountsUserIds: string[], invoiceNumber: string, invoiceId: string) {
    await this.createMany(
      accountsUserIds.map((userId) => ({
        userId,
        title: "Invoice Ready for Review",
        body: `Invoice ${invoiceNumber} is ready for your review and approval.`,
        link: `/invoices/${invoiceId}`,
      }))
    );
  }

  async notifyInvoiceApproved(pmUserId: string, invoiceNumber: string, invoiceId: string) {
    await this.create({
      userId: pmUserId,
      title: "Invoice Approved",
      body: `Invoice ${invoiceNumber} has been approved by Accounts and is ready to dispatch.`,
      link: `/invoices/${invoiceId}`,
    });
  }

  async notifyPaymentReceived(pmUserId: string, invoiceNumber: string, amount: string, invoiceId: string) {
    await this.create({
      userId: pmUserId,
      title: "Payment Received",
      body: `Payment of ${amount} received against invoice ${invoiceNumber}.`,
      link: `/invoices/${invoiceId}`,
    });
  }

  async notifyPOExpiring(userIds: string[], poInternalId: string, clientName: string, daysLeft: number, poId: string) {
    await this.createMany(
      userIds.map((userId) => ({
        userId,
        title: `PO Expiring in ${daysLeft} Days`,
        body: `PO ${poInternalId} from ${clientName} expires in ${daysLeft} days. Please take action.`,
        link: `/pos/${poId}`,
      }))
    );
  }

  async notifyComplianceExpiring(userIds: string[], docTypeName: string, clientName: string, daysLeft: number) {
    await this.createMany(
      userIds.map((userId) => ({
        userId,
        title: `Compliance Doc Expiring in ${daysLeft} Days`,
        body: `${docTypeName} for ${clientName} expires in ${daysLeft} days. Please upload a renewed document.`,
        link: `/compliance`,
      }))
    );
  }

  async notifyQuotaAlert(pmUserId: string, projectName: string, projectId: string, percentConsumed: number) {
    await this.create({
      userId: pmUserId,
      title: "PO Day Quota Alert",
      body: `Project "${projectName}" has consumed ${percentConsumed}% of its authorised PO days. Consider requesting an extension.`,
      link: `/projects/${projectId}`,
    });
  }

  async notifyEscalation(userIds: string[], invoiceNumber: string, clientName: string, daysOverdue: number, invoiceId: string) {
    await this.createMany(
      userIds.map((userId) => ({
        userId,
        title: `Payment Escalation — Invoice ${invoiceNumber}`,
        body: `Invoice ${invoiceNumber} from ${clientName} is ${daysOverdue} days overdue. Immediate follow-up required.`,
        link: `/invoices/${invoiceId}`,
      }))
    );
  }
}

export const NotificationService = new NotificationServiceClass();
