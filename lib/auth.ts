// lib/auth.ts
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import type { NextAuthOptions, Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }: { session: Session; token: { sub?: string } }) {
      if (token.sub && session.user) {
        (session.user as SessionUser).id = token.sub;
      }
      return session;
    },
  },
};
