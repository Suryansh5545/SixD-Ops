import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const division = searchParams.get("division");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const comparisonEndDate = endDate ? new Date(endDate) : new Date("2099-12-31");

    const overlappingDeployments =
      startDate
        ? await prisma.deployment.findMany({
            where: {
              equipmentId: { not: null },
              status: { not: "COMPLETED" },
              startDate: { lte: comparisonEndDate },
              OR: [{ endDate: null }, { endDate: { gte: new Date(startDate) } }],
            },
            include: {
              project: { select: { name: true } },
              equipment: { select: { id: true } },
            },
          })
        : await prisma.deployment.findMany({
            where: {
              equipmentId: { not: null },
              status: { not: "COMPLETED" },
            },
            include: {
              project: { select: { name: true } },
              equipment: { select: { id: true } },
            },
          });

    const conflictMap = new Map<string, string>();
    for (const deployment of overlappingDeployments) {
      if (deployment.equipment?.id && !conflictMap.has(deployment.equipment.id)) {
        conflictMap.set(deployment.equipment.id, deployment.project.name);
      }
    }

    const equipment = await prisma.equipment.findMany({
      where: {
        ...(division ? { division: division as import("@prisma/client").Division } : {}),
      },
      orderBy: [{ division: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        serialNumber: true,
        division: true,
        isAvailable: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: equipment.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.division,
        serialNumber: item.serialNumber,
        available: item.isAvailable && !conflictMap.has(item.id),
        conflictProject: conflictMap.get(item.id) ?? null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/equipment]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
