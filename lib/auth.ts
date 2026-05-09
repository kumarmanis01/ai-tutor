/**
 * FILE OBJECTIVE:
 * - Configure NextAuth providers and callbacks, including secure Google OAuth account linking,
 *   and expose server-side auth helpers used by protected APIs and pages.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/auth.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | enforce Google account chooser globally via authorization prompt select_account
 * - 2026-05-07T00:00:00Z | copilot | enforce Google sub/email_verified linking and restore jwt/session id propagation for onboarding auth
 * - 2026-05-07T00:00:00Z | copilot | fix jwt subjects parsing type guard to avoid never narrowing on Prisma String[]
 */

// src/lib/auth.ts
// Import necessary libraries and providers for authentication
import { PrismaAdapter } from '@next-auth/prisma-adapter'; // Connects NextAuth to your database
import GoogleProvider from 'next-auth/providers/google'; // Enables Google login/signup
import EmailProvider from 'next-auth/providers/email'; // Enables email login/signup
import { prisma } from '@/lib/prisma'; // Your Prisma database client
import { sendMail } from '@/lib/mailer';
import { welcomeEmailHtml, magicLinkHtml } from '@/lib/email/templates';
import { AUTH_NO_REPLY_EMAIL } from '@/lib/email/functionalityEmails';
import { logger } from '@/lib/logger';
import { LanguageCode } from '@/lib/normalize';
import { getServerSession } from 'next-auth/next';
import { DPDP_MINOR_AGE as _DPDP_MINOR_AGE } from '@/lib/constants/age';
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
  try {
    await sendMail({
      to,
      subject: 'Welcome to Spinzy Academy!',
      html: welcomeEmailHtml(name || to),
    });
    logger.add('Welcome email sent', { className: 'auth', methodName: 'sendWelcomeEmail' });
  } catch (error) {
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
// export const authOptions: any = {
//   adapter: PrismaAdapter(prisma), // Connects NextAuth to your database
//   // Force secure cookies because you are using HTTPS
//   useSecureCookies: true, 
//   providers: [
//     // Enable Google login/signup
//     GoogleProvider({
//       clientId: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//       // This is the specific fix for "State cookie missing" 
//       // It tells Google not to use the 'state' check which often fails behind VPS proxies
//       checks: ['pkce', 'state'], 
//     }),
//     // Enable email magic-link login via Resend
//     EmailProvider({
//       from: process.env.EMAIL_FROM ?? `Spinzy Academy <${AUTH_NO_REPLY_EMAIL}>`,
//       sendVerificationRequest: async ({ identifier, url }) => {
//         await sendMail({
//           to: identifier,
//           subject: 'Sign in to Spinzy Academy',
//           html: magicLinkHtml(url),
//           text: `Sign in to Spinzy Academy: ${url}\n\nThis link expires in 24 hours.`,
//         });
//       },
//     }),
//     /*
//       Phone OTP credentials provider (commented out)
//       ------------------------------------------------------------------
//       This provider previously allowed NextAuth to accept phone+OTP via
//       `signIn('phone-credentials', { phone, code })`. The project has moved
//       to a REST-based verify flow where `/api/auth/verify-otp` performs
//       verification and sets the NextAuth session cookie directly.

//       Keeping the code here (commented) preserves the implementation for
//       future fallback or reference while preventing the provider from being
//       active. To re-enable, remove the comment markers and ensure the
//       database migration adding `phone` to `User` has been applied.
    
//     CredentialsProvider({
//       id: 'phone-credentials',
//       name: 'Phone (OTP)',
//       credentials: {
//         phone: { label: 'Phone', type: 'text' },
//         code: { label: 'OTP', type: 'text' },
//       },
//       async authorize(credentials) {
//         if (!credentials?.phone || !credentials?.code) return null;
//         const phone = String(credentials.phone).replace(/\D/g, '');
//         const code = String(credentials.code).trim();

//         const secret = process.env.OTP_SECRET ?? 'fallback-secret';
//         const codeHash = crypto.createHash('sha256').update(`${code}${secret}`).digest('hex');

//         const record = await prisma.phoneOtp.findFirst({
//           where: { phone, codeHash, consumed: false, expiresAt: { gte: new Date() } },
//           orderBy: { createdAt: 'desc' },
//         });

//         if (!record) return null;

//         await prisma.phoneOtp.update({ where: { id: record.id }, data: { consumed: true } });

//         let user = await prisma.user.findFirst({ where: { phone } });
//         if (!user) {
//            user = await prisma.user.create({ data: { name: phone, phone, language: LanguageCode.en } });
//         }

//         return {
//           id: user.id,
//           name: user.name,
//           email: user.email,
//           image: user.image,
//         } as any;
//       },
//     }),

//     */
//   ],
//   cookies: {
//     state: {
//       name: `next-auth.state`,
//       options: {
//         httpOnly: true,
//         sameSite: "lax",
//         path: "/",
//         secure: true,
//       },
//     },
//   },
//   session: { strategy: 'jwt' }, // Use JWT for session management
//   callbacks: {
//     // This runs when a user signs in (login or signup)
//     async signIn({ user, account, profile }: any) {
//       try {
//         // Ensure a DB user record exists (create if missing). Use email as unique key.
//         if (user?.email) {
//           await prisma.user.upsert({
//             where: { email: user.email },
//             update: {},
//             create: {
//               email: user.email!,
//               name: user.name ?? undefined,
//               image: user.image ?? undefined,
//                 language: LanguageCode.en,
//               },
//           });
//         }
//         // Proactively link Google OAuth to existing user by verified email to avoid OAuthAccountNotLinked.
//         if (account?.provider === 'google') {
//           const email = (profile as any)?.email ?? user?.email;
//           const verified = (profile as any)?.email_verified ?? true;
//           if (email && verified) {
//             const existing = await prisma.user.findUnique({ where: { email } });
//             if (existing) {
//               const hasGoogle = await prisma.account.findFirst({
//                 where: { userId: existing.id, provider: 'google' },
//               });
//               if (!hasGoogle) {
//                 await prisma.account.create({
//                   data: {
//                     userId: existing.id,
//                     provider: 'google',
//                     providerAccountId: String(account.providerAccountId),
//                     type: String(account.type),
//                     access_token: (account as any).access_token ?? undefined,
//                     refresh_token: (account as any).refresh_token ?? undefined,
//                     expires_at: (account as any).expires_at ?? undefined,
//                     token_type: (account as any).token_type ?? undefined,
//                     scope: (account as any).scope ?? undefined,
//                     id_token: (account as any).id_token ?? undefined,
//                     session_state: (account as any).session_state ?? undefined,
//                   },
//                 });
//               }
//             }
//           }
//         }
//       } catch (err) {
//         logger.warn('signIn upsert user failed', { className: 'auth', methodName: 'signIn', error: String(err) });
//       }
//       await maybeSendWelcomeEmail(user.email!, user.name ?? undefined).catch((err) =>
//         logger.error(`Error in maybeSendWelcomeEmail: ${String(err)}`, { className: 'auth', methodName: 'signIn' }),
//       );
//       // logger.info('signin callback activated with user:', user.email!);
//       // Login guard: detect curriculum (board/grade) changes compared to previous login
//       try {
//         if (user?.email) {
//           const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
//           if (dbUser?.id) {
//             // Fetch the most recent two login audit entries (if any)
//             const recentLogins = await prisma.auditLog.findMany({
//               where: {
//                 targetId: dbUser.id,
//                 targetEntity: 'User',
//                 details: { path: ['legacyAction'], equals: 'student.login' },
//               },
//               orderBy: { createdAt: 'desc' },
//               take: 2,
//             });
//             const previous = recentLogins.length > 1 ? recentLogins[1] : null;
//             const prevDetails = previous?.details as { board?: string; grade?: string } | null;
//             const prevBoard = prevDetails?.board ?? null;
//             const prevGrade = prevDetails?.grade ?? null;
//             const curBoard = dbUser.board ?? null;
//             const curGrade = dbUser.grade ?? null;
//             if (previous && (prevBoard !== curBoard || prevGrade !== curGrade)) {
//               // Curriculum changed since previous login -- log the event for audit/alerting
//               logger.info('student.curriculum.changed', { studentId: dbUser.id });
//             }
//             // Always record this login with current curriculum snapshot
//             await prisma.auditLog.create({ data: { targetEntity: 'User', targetId: dbUser.id, action: null, details: { legacyAction: 'student.login', board: curBoard, grade: curGrade } } });
//           }
//         }
//       } catch (err) {
//         // Non-fatal: don't block sign-in on logging errors
//         logger.warn('signIn login-audit failed', { className: 'auth', methodName: 'signIn', error: String(err) });
//       }
//       // // Best Practice: Use welcomeEmailSent flag to ensure email is sent only once
//       // const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
//       // logger.info('Database user fetched:', dbUser);
//       // if (dbUser && !dbUser.welcomeEmailSent) {
//       //   // Send welcome email and set the flag
//       //   await sendWelcomeEmail(user.email!, user.name ?? undefined);
//       //   await prisma.user.update({
//       //     where: { email: user.email! },
//       //     data: { welcomeEmailSent: true },
//       //   });
//       //   logger.info('Welcome email sent and flag updated for:', user.email);
//       // } else {
//       //   logger.info('Welcome email already sent for:', user.email);
//       // }
//       return true;
//     },
//     // This shapes the JWT token with user info
//     async jwt({ token, user }: any) {
//       // On sign-in, set role from user object
//       if (user) {
//         token.id = user.id;
//         token.name = user.name;
//         token.email = user.email;
//         token.image = user.image;
//         if ('role' in user) token.role = user.role;
//       } else if (token.email) {
//         // no-op (DB fetch below)
//       }

//       // Always fetch latest user flags from DB (role, onboardingComplete, accountStatus).
//       // This keeps middleware gating accurate across profile updates and under-13 activation.
//       if (token.email) {
//         try {
//           const dbUser = await prisma.user.findUnique({
//             where: { email: token.email },
//             select: { role: true, grade: true, board: true, language: true, subjects: true, accountStatus: true, age: true, parentEmail: true, parentPhone: true },
//           });
//           if (dbUser) {
//             token.role = dbUser.role;
//             token.accountStatus = (dbUser as { accountStatus?: string }).accountStatus ?? 'active';
//             // Resolve subjects from both array (standard Prisma) and Neon wire-format string "{a,b,c}"
//             let subjectCount = 0;
//             if (Array.isArray(dbUser.subjects)) {
//               subjectCount = (dbUser.subjects as string[]).filter(Boolean).length;
//             } else if (typeof dbUser.subjects === 'string' && (dbUser.subjects as string).length > 0) {
//               subjectCount = (dbUser.subjects as string)
//                 .replace(/^\{/, '').replace(/\}$/, '').split(',')
//                 .filter((s) => s.trim().length > 0).length;
//             }
//             // onboardingComplete = academic profile only (board/grade/language/subjects).
//             // Age/parentEmail/parentPhone are enforced separately via accountStatus gate.
//             token.onboardingComplete = !!(
//               dbUser.grade &&
//               dbUser.board &&
//               dbUser.language &&
//               subjectCount > 0
//             );
//           }
//         } catch (err) {
//           // e.g. accountStatus column missing (migration not applied) -- fallback so OAuth still works
//           logger.warn('jwt callback DB fetch failed, using defaults', { className: 'auth', methodName: 'jwt', error: String(err) });
//           try {
//             const fallback = await prisma.user.findUnique({
//               where: { email: token.email },
//               select: { role: true, grade: true, board: true, language: true, subjects: true, age: true, parentEmail: true, parentPhone: true },
//             });
//             if (fallback) {
//               token.role = fallback.role;
//               token.accountStatus = 'active';
//               let fallbackSubjectCount = 0;
//               if (Array.isArray(fallback.subjects)) {
//                 fallbackSubjectCount = (fallback.subjects as string[]).filter(Boolean).length;
//               } else if (typeof fallback.subjects === 'string' && (fallback.subjects as string).length > 0) {
//                 fallbackSubjectCount = (fallback.subjects as string)
//                   .replace(/^\{/, '').replace(/\}$/, '').split(',')
//                   .filter((s) => s.trim().length > 0).length;
//               }
//               token.onboardingComplete = !!(fallback.grade && fallback.board && fallback.language && fallbackSubjectCount > 0);
//             }
//           } catch {
//             token.accountStatus = 'active';
//             token.onboardingComplete = false;
//           }
//         }
//       }
//       return token;
//     },
//     // This shapes the session object sent to the client
//     async session({ session, token }: any) {
//       if (session.user) {
//         // Keep session.user minimal (SessionUser). Full profile is fetched via `/api/user/profile`.
//         session.user.id = token.id as string;
//         session.user.name = token.name as string;
//         session.user.email = token.email as string;
//         session.user.image = token.image as string;
//         session.user.role = token.role as string;
//         session.user.onboardingComplete = (token.onboardingComplete as boolean) ?? false;
//         (session.user as any).accountStatus = (token.accountStatus as string) ?? 'active';

//         logger.add(`session callback populated minimal session for: ${session.user.email!}`, { className: 'auth', methodName: 'sessionCallback' });
//         // Call the standalone method to handle welcome email logic
//         await maybeSendWelcomeEmail(session.user.email!, session.user.name ?? undefined);
//       }
//       return session;
//     },
//   },
// };
const isProd = process.env.NODE_ENV === "production";

function normalizeGoogleEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isEmailVerified(profile: Record<string, unknown> | null | undefined): boolean {
  return profile?.email_verified === true;
}

export const authOptions: any = {
  adapter: PrismaAdapter(prisma),
  // Dynamically toggle based on environment
  useSecureCookies: isProd, 
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
      // 'pkce' and 'state' help prevent the "State cookie missing" error 
      // by ensuring modern security checks are active and matched.
      checks: ['pkce', 'state'], 
    }),
    EmailProvider({
      from: process.env.EMAIL_FROM ?? `Spinzy Academy <${AUTH_NO_REPLY_EMAIL}>`,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMail({
          to: identifier,
          subject: 'Sign in to Spinzy Academy',
          html: magicLinkHtml(url),
          text: `Sign in to Spinzy Academy: ${url}\n\nThis link expires in 24 hours.`,
        });
      },
    }),
  ],
  cookies: {
    state: {
      // In prod, we use the __Secure- prefix which is required for HTTPS
      name: `${isProd ? "__Secure-" : ""}next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd, 
      },
    },
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      try {
        if (account?.provider === 'google') {
          const googleSubject = String(account.providerAccountId ?? (profile as any)?.sub ?? '').trim();
          const profileObject = (profile as Record<string, unknown> | null) ?? null;
          const email = normalizeGoogleEmail((profileObject as any)?.email ?? user?.email);

          // Require verified identity assertions from Google before we sign in.
          if (!googleSubject || !email || !isEmailVerified(profileObject)) {
            logger.warn('google signIn rejected due to missing verified identity claims', {
              className: 'auth',
              methodName: 'signIn',
              hasGoogleSubject: !!googleSubject,
              hasEmail: !!email,
              emailVerified: isEmailVerified(profileObject),
            });
            return false;
          }

          const existingGoogleLink = await prisma.account.findFirst({
            where: { provider: 'google', providerAccountId: googleSubject },
            select: { userId: true },
          });

          let targetUserId = existingGoogleLink?.userId ?? null;
          if (!targetUserId) {
            const existingByEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
            targetUserId = existingByEmail?.id ?? null;
          }

          if (!targetUserId) {
            const createdUser = await prisma.user.create({
              data: {
                email,
                name: user.name ?? undefined,
                image: user.image ?? undefined,
                language: LanguageCode.en,
              },
              select: { id: true },
            });
            targetUserId = createdUser.id;
          }

          if (targetUserId) {
            const hasGoogle = await prisma.account.findFirst({
              where: { userId: targetUserId, provider: 'google', providerAccountId: googleSubject },
              select: { id: true },
            });

            if (!hasGoogle) {
              await prisma.account.create({
                data: {
                  userId: targetUserId,
                  provider: 'google',
                  providerAccountId: googleSubject,
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
        } else if (user?.email) {
          await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: {
              email: user.email,
              name: user.name ?? undefined,
              image: user.image ?? undefined,
              language: LanguageCode.en,
            },
          });
        }
      } catch (err) {
        logger.warn('signIn upsert user failed', { className: 'auth', methodName: 'signIn', error: String(err) });
      }

      if (user?.email) {
        await maybeSendWelcomeEmail(user.email, user.name ?? undefined).catch((err) =>
          logger.error(`Error in maybeSendWelcomeEmail: ${String(err)}`, { className: 'auth', methodName: 'signIn' }),
        );
      }

      try {
        if (user?.email) {
          const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
          if (dbUser?.id) {
            const recentLogins = await prisma.auditLog.findMany({
              where: {
                targetId: dbUser.id,
                targetEntity: 'User',
                details: { path: ['legacyAction'], equals: 'student.login' },
              },
              orderBy: { createdAt: 'desc' },
              take: 2,
            });
            const previous = recentLogins.length > 1 ? recentLogins[1] : null;
            const prevDetails = previous?.details as { board?: string; grade?: string } | null;
            const prevBoard = prevDetails?.board ?? null;
            const prevGrade = prevDetails?.grade ?? null;
            const curBoard = dbUser.board ?? null;
            const curGrade = dbUser.grade ?? null;
            if (previous && (prevBoard !== curBoard || prevGrade !== curGrade)) {
              logger.info('student.curriculum.changed', { studentId: dbUser.id });
            }
            await prisma.auditLog.create({ 
              data: { 
                targetEntity: 'User', 
                targetId: dbUser.id, 
                action: null, 
                details: { legacyAction: 'student.login', board: curBoard, grade: curGrade } 
              } 
            });
          }
        }
      } catch (err) {
        logger.warn('signIn login-audit failed', { className: 'auth', methodName: 'signIn', error: String(err) });
      }
      return true;
    },
    async jwt({ token, user }: any) {
      if (user?.id) {
        token.id = user.id;
      }
      if (!token.id && token.sub) {
        token.id = token.sub;
      }

      if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: {
              id: true,
              role: true,
              grade: true,
              board: true,
              language: true,
              subjects: true,
              accountStatus: true,
            },
          });

          if (dbUser) {
            token.id = token.id ?? dbUser.id;
            token.role = dbUser.role;
            token.accountStatus = (dbUser as { accountStatus?: string }).accountStatus ?? 'active';

            let subjectCount = 0;
            const rawSubjects: unknown = dbUser.subjects;
            if (Array.isArray(rawSubjects)) {
              subjectCount = (rawSubjects as string[]).filter(Boolean).length;
            } else if (typeof rawSubjects === 'string' && rawSubjects.length > 0) {
              subjectCount = rawSubjects
                .replace(/^\{/, '').replace(/\}$/, '').split(',')
                .filter((s: string) => s.trim().length > 0).length;
            }
            token.onboardingComplete = !!(dbUser.grade && dbUser.board && dbUser.language && subjectCount > 0);
          }
        } catch (err) {
          logger.warn('jwt callback DB fetch failed, using defaults', { className: 'auth', methodName: 'jwt', error: String(err) });
          token.accountStatus = (token.accountStatus as string) ?? 'active';
          token.onboardingComplete = (token.onboardingComplete as boolean) ?? false;
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = (token.id as string) ?? (token.sub as string);
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.image as string;
        session.user.role = token.role as string;
        session.user.onboardingComplete = (token.onboardingComplete as boolean) ?? false;
        (session.user as any).accountStatus = (token.accountStatus as string) ?? 'active';
      }
      return session;
    },
  },
};

