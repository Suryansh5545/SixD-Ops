import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPin: z.string().length(6).regex(/^\d+$/),
  newPin: z.string().length(6).regex(/^\d+$/),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { currentPin, newPin } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.pin) {
      return NextResponse.json({ error: "No PIN set on this account" }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPin, user.pin);
    if (!valid) {
      return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPin, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { pin: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
