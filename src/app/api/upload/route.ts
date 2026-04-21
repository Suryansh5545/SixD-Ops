/**
 * POST /api/upload — Generic file upload endpoint.
 * Returns a URL that can be stored in the database.
 *
 * Also handles serving uploaded files via GET /api/upload?path=...
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { StorageService } from "@/lib/services/StorageService";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subfolder = (formData.get("subfolder") as string) ?? "misc";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Validate subfolder to prevent path traversal
    const allowedSubfolders = ["receipts", "compliance", "reports", "invoices", "documents", "misc", "signatures"];
    const safeSub = allowedSubfolders.includes(subfolder) ? subfolder : "misc";

    const result = await StorageService.upload(file, safeSub);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[POST /api/upload]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/upload?path=uploads/subfolder/filename
 * Serves an uploaded file. Verifies authentication before serving.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorised", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return new NextResponse("Path is required", { status: 400 });
    }

    // Prevent path traversal
    if (filePath.includes("..") || filePath.includes("~")) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    const { buffer, mimeType } = await StorageService.read(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[GET /api/upload]", error);
    return new NextResponse("File not found", { status: 404 });
  }
}
