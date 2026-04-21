import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sector: true,
        paymentTermsDefault: true,
        gstPercent: true,
      },
    });

    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error("[GET /api/clients]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
