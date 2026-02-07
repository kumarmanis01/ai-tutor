// src/lib/auth.ts
// Import necessary libraries and providers for authentication
import { PrismaAdapter } from '@next-auth/prisma-adapter'; // Connects NextAuth to your database
import GoogleProvider from 'next-auth/providers/google'; // Enables Google login/signup
import FacebookProvider from 'next-auth/providers/facebook'; // Enables Meta (Facebook) login/signup
import EmailProvider from 'next-auth/providers/email'; // Enables email login/signup
import CredentialsProvider from 'next-auth/providers/credentials'; // Enables login with email & password
import { prisma } from '@/lib/prisma'; // Your Prisma database client
import bcrypt from 'bcryptjs'; // For password hashing (pure JS build for Vercel)
import { getEmailTransporter } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { LanguageCode } from '@/lib/normalize';
import { getServerSession } from 'next-auth/next';
import type { AppSession } from '@/lib/types/auth';

export async function requireAdmin() {
  const session = (await getServerSession(authOptions)) as AppSession | null;

  if (!session || session.user?.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return session;
}

// Require admin or moderator role (defense-in-depth for admin APIs)
export async function requireAdminOrModerator() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  const role = session?.user?.role ?? '';
  if (!session || !session.user || !['admin', 'moderator'].includes(role)) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Require an active session for server-side pages. If no valid session or
// matching DB user is found, callers can redirect the client to sign-in.
export async function requireActiveSession() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session || !session.user?.email) {
    return null;
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!dbUser) return null;
    return session;
  } catch (err) {
    logger.warn('requireActiveSession failed to verify DB user', { className: 'auth', methodName: 'requireActiveSession', error: String(err) });
    return null;
  }
}

// This function sends a welcome email to the user
async function sendWelcomeEmail(to: string, name?: string) {
  // Set up the email transporter using your SMTP credentials
  const transporter = getEmailTransporter();

  try {
    // Send the actual email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM_NOREPLY,
      to,
      subject: 'Welcome to Spinzy Academy!',
      html: `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2 style="color:#2d6cdf;">Welcome to Spinzy Academy, ${name || to}!</h2>
          <p>
            We're absolutely delighted to have you join our learning family.<br>
            At Spinzy Academy, your curiosity and growth are at the heart of everything we do.
          </p>
          <p>
            <strong>What’s next?</strong><br>
            Explore our resources, ask questions, and connect with fellow learners. Your journey to mastering new skills starts now!
          </p>
          <p>
            If you ever need help or just want to say hello, reply to this email or reach out to our friendly support team. We’re here for you!
          </p>
          <br>
          <p>
            Wishing you an inspiring and successful learning adventure.<br>
            <span style="color:#2d6cdf;">Warm regards,</span><br>
            <strong>The Spinzy Academy Team</strong>
          </p>
        </div>
      `,
    });
    // Log success info
    logger.add(`Welcome email sent: ${JSON.stringify(info)}`, { className: 'auth', methodName: 'sendWelcomeEmail' });
  } catch (error) {
    // Log any errors via logger
    logger.error('Failed to send welcome email', { className: 'auth', methodName: 'sendWelcomeEmail', error: String(error) });
  }
}

// Standalone method to check flag, send welcome email, and update flag
async function maybeSendWelcomeEmail(email: string, name?: string) {
  // Fetch user from DB
  const dbUser = await prisma.user.findUnique({ where: { email } });
  logger.add(`[maybeSendWelcomeEmail] Database user fetched: ${JSON.stringify(dbUser)}`, { className: 'auth', methodName: 'maybeSendWelcomeEmail' });
  if (dbUser && !dbUser.welcomeEmailSent) {
    // Send welcome email
    await sendWelcomeEmail(email, name);
    // Update flag
    await prisma.user.update({
      where: { email },
      data: { welcomeEmailSent: true },
    });
    logger.add(`[maybeSendWelcomeEmail] Welcome email sent and flag updated for: ${email}`, { className: 'auth', methodName: 'maybeSendWelcomeEmail' });
  } else {
    logger.add(`[maybeSendWelcomeEmail] Welcome email already sent for: ${email}`, { className: 'auth', methodName: 'maybeSendWelcomeEmail' });
  }
}

// Main NextAuth configuration object
export const authOptions: any = {
  adapter: PrismaAdapter(prisma), // Connects NextAuth to your database
  providers: [
    // Enable Google login/signup
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Enable Meta (Facebook) login/signup
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    // Enable email login/signup
    EmailProvider({
      // Use explicit SMTP object so NextAuth uses the same SMTP config
      // as `lib/mailer.ts` (host/port/user/password). This avoids relying
      // on a single `EMAIL_SERVER` URL and keeps configuration explicit.
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
        secure: true,
      },
      from:
        process.env.EMAIL_FROM_NOREPLY ||
        process.env.EMAIL_FROM ||
        `"Spinzy Academy" <${process.env.EMAIL_SERVER_USER}>`,
    }),
    // Enable login with email & password
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // This function checks if the user's credentials are correct
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) return null;
        // Find the user in the database
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        // Compare the entered password with the stored hash
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        // Return minimal identity for the session; full profile is fetched by the client
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
    /*
      Phone OTP credentials provider (commented out)
      ------------------------------------------------------------------
      This provider previously allowed NextAuth to accept phone+OTP via
      `signIn('phone-credentials', { phone, code })`. The project has moved
      to a REST-based verify flow where `/api/auth/verify-otp` performs
      verification and sets the NextAuth session cookie directly.

      Keeping the code here (commented) preserves the implementation for
      future fallback or reference while preventing the provider from being
      active. To re-enable, remove the comment markers and ensure the
      database migration adding `phone` to `User` has been applied.
    
    CredentialsProvider({
      id: 'phone-credentials',
      name: 'Phone (OTP)',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;
        const phone = String(credentials.phone).replace(/\D/g, '');
        const code = String(credentials.code).trim();

        const secret = process.env.OTP_SECRET ?? 'fallback-secret';
        const codeHash = crypto.createHash('sha256').update(`${code}${secret}`).digest('hex');

        const record = await prisma.phoneOtp.findFirst({
          where: { phone, codeHash, consumed: false, expiresAt: { gte: new Date() } },
          orderBy: { createdAt: 'desc' },
        });

        if (!record) return null;

        await prisma.phoneOtp.update({ where: { id: record.id }, data: { consumed: true } });

        let user = await prisma.user.findFirst({ where: { phone } });
        if (!user) {
           user = await prisma.user.create({ data: { name: phone, phone, language: LanguageCode.en } });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        } as any;
      },
    }),

    */
  ],
  session: { strategy: 'jwt' }, // Use JWT for session management
  callbacks: {
    // This runs when a user signs in (login or signup)
    async signIn({ user, account, profile }: any) {
      try {
        // Ensure a DB user record exists (create if missing). Use email as unique key.
        if (user?.email) {
          await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: {
              email: user.email!,
              name: user.name ?? undefined,
              image: user.image ?? undefined,
                language: LanguageCode.en,
              },
          });
        }
        // Proactively link Google OAuth to existing user by verified email to avoid OAuthAccountNotLinked.
        if (account?.provider === 'google') {
          const email = (profile as any)?.email ?? user?.email;
          const verified = (profile as any)?.email_verified ?? true;
          if (email && verified) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
              const hasGoogle = await prisma.account.findFirst({
                where: { userId: existing.id, provider: 'google' },
              });
              if (!hasGoogle) {
                await prisma.account.create({
                  data: {
                    userId: existing.id,
                    provider: 'google',
                    providerAccountId: String(account.providerAccountId),
                    type: String(account.type),
                    access_token: (account as any).access_token ?? undefined,
                    refresh_token: (account as any).refresh_token ?? undefined,
                    expires_at: (account as any).expires_at ?? undefined,
                    token_type: (account as any).token_type ?? undefined,
                    scope: (account as any).scope ?? undefined,
                    id_token: (account as any).id_token ?? undefined,
                    session_state: (account as any).session_state ?? undefined,
                  },
                });
              }
            }
          }
        }
        // Proactively link Facebook OAuth to existing user by email to avoid OAuthAccountNotLinked.
        if (account?.provider === 'facebook') {
          const email = (profile as any)?.email ?? user?.email;
          // Facebook may not always verify emails, so we trust the email if present
          if (email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
              const hasFacebook = await prisma.account.findFirst({
                where: { userId: existing.id, provider: 'facebook' },
              });
              if (!hasFacebook) {
                await prisma.account.create({
                  data: {
                    userId: existing.id,
                    provider: 'facebook',
                    providerAccountId: String(account.providerAccountId),
                    type: String(account.type),
                    access_token: (account as any).access_token ?? undefined,
                    refresh_token: (account as any).refresh_token ?? undefined,
                    expires_at: (account as any).expires_at ?? undefined,
                    token_type: (account as any).token_type ?? undefined,
                    scope: (account as any).scope ?? undefined,
                  },
                });
              }
            }
          }
        }
      } catch (err) {
        logger.warn('signIn upsert user failed', { className: 'auth', methodName: 'signIn', error: String(err) });
      }
      await maybeSendWelcomeEmail(user.email!, user.name ?? undefined).catch((err) =>
        logger.error(`Error in maybeSendWelcomeEmail: ${String(err)}`, { className: 'auth', methodName: 'signIn' }),
      );
      // console.log('signin callback activated with user:', user.email!);
      // // Best Practice: Use welcomeEmailSent flag to ensure email is sent only once
      // const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
      // console.log('Database user fetched:', dbUser);
      // if (dbUser && !dbUser.welcomeEmailSent) {
      //   // Send welcome email and set the flag
      //   await sendWelcomeEmail(user.email!, user.name ?? undefined);
      //   await prisma.user.update({
      //     where: { email: user.email! },
      //     data: { welcomeEmailSent: true },
      //   });
      //   console.log('Welcome email sent and flag updated for:', user.email);
      // } else {
      //   console.log('Welcome email already sent for:', user.email);
      // }
      return true;
    },
    // This shapes the JWT token with user info
    async jwt({ token, user }: any) {
      // On sign-in, set role from user object
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
        if ('role' in user) token.role = user.role;
        token.onboardingComplete = !!((user as any).grade && (user as any).board);
      } else if (token.email) {
        // Always fetch latest role from DB for every request
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.role = dbUser.role;
          token.onboardingComplete = !!(dbUser.grade && dbUser.board);
        }
      }
      return token;
    },
    // This shapes the session object sent to the client
    async session({ session, token }: any) {
      if (session.user) {
        // Keep session.user minimal (SessionUser). Full profile is fetched via `/api/user/profile`.
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.image as string;
        session.user.role = token.role as string;
        session.user.onboardingComplete = (token.onboardingComplete as boolean) ?? false;

        logger.add(`session callback populated minimal session for: ${session.user.email!}`, { className: 'auth', methodName: 'sessionCallback' });
        // Call the standalone method to handle welcome email logic
        await maybeSendWelcomeEmail(session.user.email!, session.user.name ?? undefined);
      }
      return session;
    },
  },
};
