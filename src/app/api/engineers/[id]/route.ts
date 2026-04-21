import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const { id } = params;

    const engineer = await prisma.engineer.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, isActive: true },
        },
        deployments: {
          where: {
            endDate: { gte: new Date() },
          },
          include: {
            project: {
              select: {
                id: true,
                projectId: true,
                title: true,
                status: true,
                po: { select: { client: { select: { name: true } } } },
              },
            },
          },
          orderBy: { startDate: "asc" },
        },
      },
    });

    if (!engineer) {
      return NextResponse.json({ error: "Engineer not found" }, { status: 404 });
    }

    // Log entries for this engineer (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await prisma.logSheetEntry.findMany({
      where: {
        engineerId: engineer.id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: "desc" },
      take: 30,
      include: {
        project: { select: { id: true, title: true, projectId: true } },
      },
    });

    return NextResponse.json({
      ...engineer,
      recentLogs,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Engineer GET]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const { id } = params;
    const body = await req.json();

    const { currentStatus } = body;

    const engineer = await prisma.engineer.update({
      where: { id },
      data: {
        ...(currentStatus !== undefined && { currentStatus }),
      },
    });

    return NextResponse.json(engineer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Engineer PATCH]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
