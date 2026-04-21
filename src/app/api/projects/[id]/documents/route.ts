/**
 * GET  /api/projects/[id]/documents — List project documents
 * POST /api/projects/[id]/documents — Upload a document to the project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sanitiseText } from "@/lib/utils/permissions";
import { StorageService } from "@/lib/services/StorageService";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const documents = await prisma.projectDocument.findMany({
      where: { projectId: params.id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    console.error("[GET /api/projects/:id/documents]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "File is required" }, { status: 400 });
    }

    const uploadResult = await StorageService.upload(file, `documents/${params.id}`);

    const doc = await prisma.projectDocument.create({
      data: {
        projectId: params.id,
        name: name ? sanitiseText(name) : file.name,
        fileUrl: uploadResult.url,
        fileSize: uploadResult.size,
        mimeType: uploadResult.mimeType,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "ProjectDocument",
        entityId: doc.id,
        action: "UPLOADED",
        performedById: session.user.id,
        description: `Document "${doc.name}" uploaded to project`,
        projectId: params.id,
      },
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/:id/documents]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
