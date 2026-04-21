import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { StorageService } from "@/lib/services/StorageService";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    assertPermission(session.user.roles, "compliance:manage");

    const { id } = params;
    const body = await req.json();
    const { fileUrl, fileName, expiryDate, status } = body;

    const updated = await prisma.projectComplianceDoc.update({
      where: { id },
      data: {
        ...(fileUrl !== undefined && { fileUrl }),
        ...(fileName !== undefined && { fileName }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(status !== undefined && { status }),
        uploadedAt: new Date(),
        uploadedById: session.user.id,
      },
      include: {
        docType: true,
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Compliance PATCH]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    assertPermission(session.user.roles, "compliance:manage");

    const { id } = params;

    // Get doc to delete file
    const doc = await prisma.projectComplianceDoc.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Reset the document (don't delete the record, just clear file)
    const updated = await prisma.projectComplianceDoc.update({
      where: { id },
      data: {
        fileUrl: null,
        fileName: null,
        expiryDate: null,
        status: "PENDING",
        uploadedAt: null,
        uploadedById: null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Compliance DELETE]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
