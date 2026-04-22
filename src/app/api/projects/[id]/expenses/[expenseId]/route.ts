/**
 * PATCH /api/projects/[id]/expenses/[expenseId] — Approve or reject an expense
 * DELETE /api/projects/[id]/expenses/[expenseId] — Delete expense (engineer, before approval)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getPermissionOverrides,
  guardRoute,
  sanitiseText,
} from "@/lib/utils/permissions";
import { ApproveExpenseSchema } from "@/lib/validations/expense";
import { NotificationService } from "@/lib/services/NotificationService";

type RouteContext = { params: { id: string; expenseId: string } };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "expense:approve",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = ApproveExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { approved, rejectionReason } = parsed.data;

    if (!approved && !rejectionReason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required when rejecting an expense" },
        { status: 400 }
      );
    }

    const expense = await prisma.expenseClaim.findUnique({
      where: { id: params.expenseId },
      include: {
        engineer: { include: { user: { select: { id: true, name: true } } } },
        project: { select: { name: true, pmId: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense claim not found" }, { status: 404 });
    }

    if (expense.projectId !== params.id) {
      return NextResponse.json({ success: false, error: "Expense does not belong to this project" }, { status: 400 });
    }

    const sanitisedReason = rejectionReason ? sanitiseText(rejectionReason) : null;

    const updated = await prisma.expenseClaim.update({
      where: { id: params.expenseId },
      data: {
        approvedByPM: approved,
        rejectedByPM: !approved,
        rejectionReason: sanitisedReason,
        approvedAt: approved ? new Date() : null,
      },
    });

    // Notify engineer
    if (approved) {
      await NotificationService.notifyExpenseApproved(
        expense.engineer.user.id,
        expense.project.name
      );
    } else {
      await NotificationService.notifyExpenseRejected(
        expense.engineer.user.id,
        expense.project.name,
        sanitisedReason ?? "No reason provided"
      );
    }

    // Check if all expenses for this project are now approved → auto-advance status
    if (approved) {
      await checkAndAdvanceProjectStatus(params.id, session.user.id);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/projects/:id/expenses/:expenseId]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const expense = await prisma.expenseClaim.findUnique({
      where: { id: params.expenseId },
      include: { engineer: { select: { userId: true } } },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    // Only the submitting engineer or MD can delete
    const isMD = session.user.roles.includes("MD" as import("@prisma/client").Role);
    const isOwner = expense.engineer.userId === session.user.id;

    if (!isMD && !isOwner) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (expense.approvedByPM) {
      return NextResponse.json(
        { success: false, error: "Cannot delete an approved expense claim" },
        { status: 409 }
      );
    }

    await prisma.expenseClaim.delete({ where: { id: params.expenseId } });

    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("[DELETE /api/projects/:id/expenses/:expenseId]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * If all expenses for the project are approved, advance project status to EXPENSES_RECEIVED.
 */
async function checkAndAdvanceProjectStatus(projectId: string, performedById: string) {
  const pendingCount = await prisma.expenseClaim.count({
    where: {
      projectId,
      approvedByPM: false,
      rejectedByPM: false,
    },
  });

  if (pendingCount === 0) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true, name: true },
    });

    if (project && project.status === "WORK_COMPLETED") {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: projectId },
          data: { status: "EXPENSES_RECEIVED" },
        });

        await tx.auditLog.create({
          data: {
            entityType: "Project",
            entityId: projectId,
            action: "STATUS_CHANGED",
            performedById,
            oldValue: { status: "WORK_COMPLETED" },
            newValue: { status: "EXPENSES_RECEIVED" },
            description: "All expenses approved — status advanced to Expenses Received",
            projectId,
          },
        });
      });
    }
  }
}
