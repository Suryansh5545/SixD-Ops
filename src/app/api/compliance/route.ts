/**
 * GET  /api/compliance — List compliance documents (with status, filters)
 * POST /api/compliance — Upload a new compliance document
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getPermissionOverrides,
  guardRoute,
  sanitiseText,
} from "@/lib/utils/permissions";
import { StorageService } from "@/lib/services/StorageService";
import { computeComplianceStatus } from "@/lib/utils/date";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "compliance:view",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const docTypeId = searchParams.get("docTypeId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const skip = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(docTypeId ? { docTypeId } : {}),
      ...(status ? { status: status as import("@prisma/client").ComplianceDocStatus } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.complianceDocument.findMany({
        where,
        include: {
          client: true,
          docType: true,
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ expiryDate: "asc" }],
        skip,
        take: limit,
      }),
      prisma.complianceDocument.count({ where }),
    ]);

    // Sync status fields — auto-compute from current date
    const now = new Date();
    const updatedItems = await Promise.all(
      items.map(async (doc) => {
        const computedStatus = computeComplianceStatus(doc.expiryDate);
        if (computedStatus !== doc.status) {
          await prisma.complianceDocument.update({
            where: { id: doc.id },
            data: { status: computedStatus },
          });
          return { ...doc, status: computedStatus };
        }
        return doc;
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        items: updatedItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/compliance]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "compliance:upload",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string | null;
    const docTypeId = formData.get("docTypeId") as string | null;
    const validFrom = formData.get("validFrom") as string | null;
    const expiryDate = formData.get("expiryDate") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!file || !clientId || !docTypeId || !validFrom || !expiryDate) {
      return NextResponse.json(
        { success: false, error: "file, clientId, docTypeId, validFrom, and expiryDate are required" },
        { status: 400 }
      );
    }

    const upload = await StorageService.upload(file, "compliance");

    const expiryDateObj = new Date(expiryDate);
    const computedStatus = computeComplianceStatus(expiryDateObj);

    const doc = await prisma.complianceDocument.create({
      data: {
        clientId,
        docTypeId,
        validFrom: new Date(validFrom),
        expiryDate: expiryDateObj,
        fileUrl: upload.url,
        notes: notes ? sanitiseText(notes) : null,
        uploadedById: session.user.id,
        status: computedStatus,
      },
      include: {
        client: true,
        docType: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "ComplianceDocument",
        entityId: doc.id,
        action: "UPLOADED",
        performedById: session.user.id,
        newValue: { docType: doc.docType.name, client: doc.client.name, expiryDate },
        description: `Compliance doc "${doc.docType.name}" uploaded for ${doc.client.name} (expires ${expiryDate})`,
      },
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/compliance]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
