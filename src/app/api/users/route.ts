import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const role =
      roleParam && roleParam in Role
        ? (roleParam as Role)
        : null;

    const users = await prisma.user.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(role
          ? {
              OR: [{ role }, { roles: { has: role } }],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: true,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
