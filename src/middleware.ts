/**
 * Next.js Middleware
 *
 * Runs on every matched request before it reaches the route handler.
 * Responsibilities:
 *   1. Rate limit authentication endpoints (10 req/min per IP)
 *
 * Page auth and redirects are handled client-side to keep the UI out of the
 * Edge runtime and avoid server-side rendering/session checks for app pages.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limiter (resets per worker instance on VPS)
// For production scale, replace with Redis-backed rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 10; // requests per minute
const AUTH_RATE_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
    return true; // Allowed
  }

  if (record.count >= AUTH_RATE_LIMIT) {
    return false; // Rate limited
  }

  record.count++;
  return true;
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limit /api/auth/* endpoints
  if (pathname.startsWith("/api/auth/")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please wait a minute and try again." },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (manifest.json, sw.js, icons/)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
