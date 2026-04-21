/**
 * Extends the NextAuth Session and JWT types with SixD-specific fields.
 * This file is required for TypeScript to recognise the custom fields
 * added in src/lib/auth.ts callbacks.
 */

import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      roles: Role[];
      isActive: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    roles: Role[];
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    roles: Role[];
    isActive: boolean;
  }
}
