/**
 * NextAuth v5 configuration
 *
 * Supports two login methods:
 *  1. Email + password (all roles)
 *  2. 6-digit PIN (field engineers, optimised for mobile plant-floor use)
 *
 * JWT session stores: id, name, email, role, roles, isActive
 * Session expiry: SESSION_EXPIRY_HOURS env var (default: 8h)
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const sessionMaxAge =
  parseInt(process.env.SESSION_EXPIRY_HOURS ?? "8", 10) * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: sessionMaxAge,
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        pin: { label: "PIN", type: "text" },
        loginMode: { label: "Login Mode", type: "text" }, // "password" | "pin"
      },

      async authorize(credentials) {
        if (!credentials?.email) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.isActive) return null;

        const loginMode = credentials.loginMode as string;

        if (loginMode === "pin") {
          // PIN login — for field engineers
          if (!credentials.pin || !user.pin) return null;
          const pinMatch = await bcrypt.compare(
            credentials.pin as string,
            user.pin
          );
          if (!pinMatch) return null;
        } else {
          // Password login — standard
          if (!credentials.password || !user.passwordHash) return null;
          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          if (!passwordMatch) return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roles: user.roles,
          isActive: user.isActive,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Persist custom fields into the JWT token.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.roles = (user as { roles: Role[] }).roles;
        token.isActive = (user as { isActive: boolean }).isActive;
      }
      return token;
    },

    /**
     * Expose custom JWT fields to the session object accessible in components.
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.roles = token.roles as Role[];
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});

/**
 * Returns the current session user, or null if unauthenticated.
 * Use in Server Components and API route handlers.
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user;
}

/**
 * Asserts the user is authenticated and throws a 401 response if not.
 * Use at the top of API route handlers.
 */
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Response(
      JSON.stringify({ success: false, error: "Unauthorised" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return user;
}
