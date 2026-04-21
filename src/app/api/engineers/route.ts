/**
 * GET /api/engineers — List all engineers with availability and current status
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const division = searchParams.get("division");
    const available = searchParams.get("available");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // If checking availability for a date range, find engineers with no conflicting deployments
    let unavailableEngineerIds: string[] = [];
    if (startDate) {
      const conflicts = await prisma.deployment.findMany({
        where: {
          status: { not: "COMPLETED" },
          OR: [
            {
              startDate: { lte: endDate ? new Date(endDate) : new Date("2099-12-31") },
              OR: [
                { endDate: null },
                { endDate: { gte: new Date(startDate) } },
              ],
            },
          ],
        },
        select: { engineerId: true },
      });
      unavailableEngineerIds = conflicts.map((c) => c.engineerId);
    }

    const engineers = await prisma.engineer.findMany({
      where: {
        ...(division ? { division: division as import("@prisma/client").Division } : {}),
        ...(available === "true" && startDate
          ? { id: { notIn: unavailableEngineerIds } }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            roles: true,
            isActive: true,
          },
        },
        deployments: {
          where: {
            status: { not: "COMPLETED" },
          },
          include: {
            project: { select: { id: true, name: true, status: true } },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
      orderBy: [{ division: "asc" }, { level: "asc" }],
    });

    // Annotate with availability
    const engineersWithAvailability = engineers.map((eng) => ({
      ...eng,
      isAvailableForDates:
        startDate ? !unavailableEngineerIds.includes(eng.id) : null,
    }));

    return NextResponse.json({ success: true, data: engineersWithAvailability });
  } catch (error) {
    console.error("[GET /api/engineers]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
