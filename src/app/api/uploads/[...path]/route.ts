/**
 * Static file server for the uploads directory.
 * Files are stored on the local filesystem outside of public/.
 * This route streams them with correct Content-Type headers.
 */

import { NextResponse } from "next/server";
import { join } from "path";
import { stat, readFile } from "fs/promises";
import { requireAuth } from "@/lib/auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(
  req: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    // Require authentication to access any file
    await requireAuth();

    const filePath = join(process.cwd(), UPLOAD_DIR, ...params.path);

    // Security: prevent path traversal
    const resolvedUploadDir = join(process.cwd(), UPLOAD_DIR);
    if (!filePath.startsWith(resolvedUploadDir)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      await stat(filePath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    const filename = params.path[params.path.length - 1];

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Uploads GET]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
