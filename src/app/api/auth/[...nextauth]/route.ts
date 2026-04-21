/**
 * NextAuth v5 route handler.
 * Handles all /api/auth/* requests (signin, signout, session, csrf).
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
