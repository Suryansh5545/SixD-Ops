/**
 * GET  /api/projects/[id]/expenses — List expenses for a project
 * POST /api/projects/[id]/expenses — Submit a new expense claim
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { guardRoute, sanitiseText } from "@/lib/utils/permissions";
import { CreateExpenseSchema, ApproveExpenseSchema } from "@/lib/validations/expense";
import { NotificationService } from "@/lib/services/NotificationService";
import { StorageService } from "@/lib/services/StorageService";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const isEngineer = session.user.roles.includes("FIELD_ENGINEER" as import("@prisma/client").Role);

    const where = {
      projectId: params.id,
      ...(isEngineer
        ? { engineer: { userId: session.user.id } }
        : {}),
    };

    const expenses = await prisma.expenseClaim.findMany({
      where,
      include: {
        engineer: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: expenses });
  } catch (error) {
    console.error("[GET /api/projects/:id/expenses]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — Submit a new expense claim.
 * Accepts multipart/form-data when a receipt file is attached.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(session.user.roles, "expense:submit");
    if (guard) return guard;

    const engineer = await prisma.engineer.findUnique({ where: { userId: session.user.id } });
    if (!engineer) {
      return NextResponse.json({ success: false, error: "Engineer record not found" }, { status: 404 });
    }

    let receiptUrl: string | null = null;
    let parsedBody: { category: string; amount: number; description?: string | null };

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("receipt") as File | null;
      if (file) {
        const upload = await StorageService.upload(file, "receipts");
        receiptUrl = upload.url;
      }
      parsedBody = {
        category: formData.get("category") as string,
        amount: parseFloat(formData.get("amount") as string),
        description: formData.get("description") as string | null,
      };
    } else {
      parsedBody = await req.json();
    }

    const parsed = CreateExpenseSchema.safeParse({ ...parsedBody, projectId: params.id });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.description) data.description = sanitiseText(data.description);

    const expense = await prisma.expenseClaim.create({
      data: {
        projectId: params.id,
        engineerId: engineer.id,
        category: data.category,
        amount: data.amount,
        description: data.description,
        receiptUrl,
      },
      include: {
        engineer: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Notify PM
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { pmId: true, name: true },
    });

    if (project) {
      await NotificationService.notifyExpenseSubmitted(
        project.pmId,
        expense.engineer.user.name,
        project.name,
        params.id
      );
    }

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/:id/expenses]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/expenses/[expenseId]/approve
 * Approve or reject an expense claim.
 * Handled separately — see /api/projects/[id]/expenses/[expenseId]/route.ts
 */
