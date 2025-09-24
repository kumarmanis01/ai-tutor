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
import FacebookProvider from "next-auth/providers/facebook";
import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Google (recommended)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Facebook (Meta) — optional, add in Google Console equivalent
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),

    // Email provider (magic link). Requires SMTP (EMAIL_SERVER)
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],

  // Use JWT tokens for sessions (suitable for App Router)
  session: {
    strategy: "jwt",
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
