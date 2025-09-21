// lib/authOptions.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";

/**
 * NextAuth configuration.
 * - Uses PrismaAdapter to persist users/sessions (swap DB provider later)
 * - Providers are pluggable; add/remove easily
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER || "",
      from: process.env.EMAIL_FROM || "",
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, user }) {
      // attach user id & preferred language for easy access client-side
      if (session.user) {
        session.user.id = user.id;
        (session.user as any).language = (user as any).language ?? "en";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
