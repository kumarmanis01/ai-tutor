// lib/authOptions.ts
/**
 * Central NextAuth options used across app.
 * - Providers: Google, Facebook (Meta), Email
 * - Adapter: Prisma (using prisma client from lib/db)
 * - Session: JWT strategy; persist user id in token
 *
 * Make sure environment variables are set in .env.local.
 */

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/db";
import NextAuth from "next-auth";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Google (recommended)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // Use JWT tokens for sessions (suitable for App Router)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Keep a stable secret for NextAuth
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // Persist user.id on the token when initial sign-in occurs
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id;
      }
      return token;
    },

    // Attach user.id to session.user on each session call
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
