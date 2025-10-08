import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

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
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        // Explicitly map fields for session, convert Date to string
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          parentEmail: user.parentEmail,
          grade: user.grade,
          country: user.country,
          language: user.language,
          createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
        if ('role' in user) token.role = user.role;
        if ('parentEmail' in user) token.parentEmail = user.parentEmail;
        if ('grade' in user) token.grade = user.grade;
        if ('country' in user) token.country = user.country;
        if ('language' in user) token.language = user.language;
        if ('createdAt' in user) token.createdAt = user.createdAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.image as string;
        session.user.role = token.role as string;
        session.user.parentEmail = token.parentEmail as string;
        session.user.grade = token.grade as string;
        session.user.country = token.country as string;
        session.user.language = token.language as string;
        session.user.createdAt = token.createdAt as string;
      }
      return session;
    },
  },
};
