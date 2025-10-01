import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/db';
import type { NextAuthOptions, Session, User } from 'next-auth';

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
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/', // Redirect to root for sign-in
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }: { token: Record<string, unknown>; user?: User }) {
      if (user && user.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: Record<string, unknown> }) {
      if (session.user && token.sub) {
        (session.user as SessionUser).id = token.sub as string;
      }
      return session;
    },
  },
};
