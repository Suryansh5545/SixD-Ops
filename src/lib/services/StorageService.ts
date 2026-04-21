/**
 * StorageService — File storage abstraction.
 *
 * Development/VPS: Local filesystem under UPLOAD_DIR.
 * Production swap: Replace implementation with S3/Cloudflare R2 calls
 * without changing any call sites.
 *
 * Uploaded files are served via /api/uploads/[...path] route.
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? "10", 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export interface UploadResult {
  url: string;       // Public-facing path: /uploads/[subfolder]/[filename]
  filename: string;
  size: number;
  mimeType: string;
}

class StorageServiceClass {
  /**
   * Saves a file from a FormData File object to the local filesystem.
   *
   * @param file - The File object from FormData
   * @param subfolder - Logical subfolder: "receipts" | "compliance" | "reports" | "invoices" | "documents"
   * @returns UploadResult with the public URL path
   */
  async upload(file: File, subfolder: string): Promise<UploadResult> {
    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`);
    }

    // Validate type
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error(`File type "${file.type}" is not allowed`);
    }

    // Generate a unique filename to prevent collisions
    const ext = path.extname(file.name) || ".bin";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    const dir = path.join(UPLOAD_DIR, subfolder);
    const fullPath = path.join(dir, uniqueName);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buffer);

    return {
      url: `/uploads/${subfolder}/${uniqueName}`,
      filename: uniqueName,
      size: file.size,
      mimeType: file.type,
    };
  }

  /**
   * Deletes a file from storage given its URL path.
   * Does not throw if file doesn't exist.
   *
   * @param url - The /uploads/... path stored in the database
   */
  async delete(url: string): Promise<void> {
    try {
      // Strip the leading /uploads/ prefix and join with local UPLOAD_DIR
      const relativePath = url.replace(/^\/uploads\//, "");
      const fullPath = path.join(UPLOAD_DIR, relativePath);
      await fs.unlink(fullPath);
    } catch {
      // File may already be gone — log but don't throw
      console.warn("[StorageService] Could not delete file:", url);
    }
  }

  /**
   * Reads a file from storage and returns its buffer.
   * Used for serving files through the API upload route.
   */
  async read(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const relativePath = url.replace(/^\/uploads\//, "");
    const fullPath = path.join(UPLOAD_DIR, relativePath);
    const buffer = await fs.readFile(fullPath);

    // Infer MIME type from extension
    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
    };

    return {
      buffer,
      mimeType: mimeMap[ext] ?? "application/octet-stream",
    };
  }
}

export const StorageService = new StorageServiceClass();
