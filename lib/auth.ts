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
 * - 2026-05-15T00:00:00Z | copilot | make useVerificationToken idempotent by returning null on Prisma P2025 (already-consumed magic link)
 * - 2026-05-12T00:00:00Z | copilot | derive onboardingComplete strictly from accountStatus and require active account in requireActiveSession
 * - 2026-05-11T00:00:00Z | claude | fix Google sign-in: remove redundant explicit PKCE checks and cookie overrides
 *     (useSecureCookies:isProd drives security; overrides caused OAuthCallback errors in production),
 *     tighten isEmailVerified to normalize strings case-insensitively and reject unknown types,
 *     route OAuth errors to /auth/get-started (the primary user-facing entry point)
 * - 2026-05-11T00:00:00Z | copilot | harden Google sign-in: derive isProd from NEXTAUTH_URL, fix linkAccount to return
 *     account, add pages.error routing, retry UI on signup/signin pages
 * - 2026-05-08T00:00:00Z | copilot | enforce Google account chooser globally via authorization prompt select_account
 * - 2026-05-07T00:00:00Z | copilot | enforce Google sub/email_verified linking and restore jwt/session id propagation for onboarding auth
 * - 2026-05-07T00:00:00Z | copilot | fix jwt subjects parsing type guard to avoid never narrowing on Prisma String[]
 * - 2026-05-13T00:00:00Z | copilot | emit signin analytics (`STUDENT.AUTH_SIGNIN`) in sign-in callback (best-effort)
 * - 2026-05-17T00:00:00Z | reviewer | document cache invalidation contract on JWT session cache key
 */
/*
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | copilot | fix: log timing catch error to avoid unused 'e' warning
 */

// src/lib/auth.ts
// Import necessary libraries and providers for authentication
import { PrismaAdapter } from '@next-auth/prisma-adapter'; // Connects NextAuth to your database
import GoogleProvider from 'next-auth/providers/google'; // Enables Google login/signup
import CredentialsProvider from 'next-auth/providers/credentials'; // Enables email+password login (admin auth flow)
import { compare } from 'bcryptjs';
// EmailProvider is disabled per request -- keep Google-only sign-in flow
// import EmailProvider from 'next-auth/providers/email'; // Enables email login/signup
import { prisma } from '@/lib/prisma'; // Your Prisma database client
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { welcomeEmailHtml, magicLinkHtml as _magicLinkHtml } from '@/lib/email/templates';
import { AUTH_NO_REPLY_EMAIL as _AUTH_NO_REPLY_EMAIL } from '@/lib/email/functionalityEmails';
import { logger } from '@/lib/logger';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { LanguageCode } from '@/lib/normalize';
import { getServerSession } from 'next-auth/next';
import crypto from 'crypto';
import { getRedis } from '@/lib/redis';
import { incJwtCacheHit, incJwtCacheMiss } from '@/lib/metrics';
export { invalidateUserSessionCache } from '@/lib/sessionCacheUtils';
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

// Require an active session for server-side pages. Returns null (callers
// redirect to sign-in) when unauthenticated or account is not active.
// accountStatus is already populated by the JWT callback (DB-fetched and
// Redis-cached at 30 s TTL) -- no second DB round trip needed here.
export async function requireActiveSession() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session || !session.user?.email) return null;
  if ((session.user as any).accountStatus !== 'active') return null;
  return session;
}

/**
 * Returns the session ONLY when the caller is an active parent. Use at the top
 * of every /api/parent/* route -- relying solely on a parentStudent link check
 * is insufficient defense in depth: a student account that learned a sibling's
 * studentId could otherwise read the link row and bypass the guard.
 */
export async function requireParentSession() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session || !session.user?.email) return null;
  if ((session.user as any).accountStatus !== 'active') return null;
  if ((session.user as any).role !== 'parent') return null;
  return session;
}

/**
 * Returns the session ONLY when the caller is an active student (`role === 'user'`).
 * Symmetric to requireParentSession; use on routes that should never be hit by
 * a parent or admin account.
 */
export async function requireStudentSession() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session || !session.user?.email) return null;
  if ((session.user as any).accountStatus !== 'active') return null;
  if ((session.user as any).role !== 'user') return null;
  return session;
}

// This function sends a welcome email to the user
async function sendWelcomeEmail(to: string, name?: string) {
  try {
    await sendEmailUnifiedSafe({
      mode: 'raw',
      delivery: 'best_effort',
      to,
      subject: 'Welcome to Spinzy Academy!',
      html: welcomeEmailHtml(name || to),
      reason: 'student_welcome_email',
      featureFlagDomain: 'notification',
    });
    logger.add('Welcome email sent', { className: 'auth', methodName: 'sendWelcomeEmail' });
  } catch (error) {
    logger.error('Failed to send welcome email', { className: 'auth', methodName: 'sendWelcomeEmail', error: String(error) });
  }
}

// Standalone method to check flag, send welcome email, and update flag
async function maybeSendWelcomeEmail(email: string, name?: string) {
  // Fetch user from DB
  const dbUser = await prisma.user.findUnique({ where: { email }, select: { welcomeEmailSent: true } });
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

// which the browser silently drops on non-HTTPS connections.
// Fallback to NODE_ENV when NEXTAUTH_URL is unset so misconfigured environments stay safe.
const nextauthUrl = process.env.NEXTAUTH_URL ?? '';
const urlIsHttps = nextauthUrl.startsWith('https://');
const nodeEnvIsProd = process.env.NODE_ENV === 'production';
const isProd = nextauthUrl ? urlIsHttps : nodeEnvIsProd;

if (nodeEnvIsProd && nextauthUrl && !urlIsHttps) {
  // Log at startup so the misconfiguration is immediately visible in PM2 logs.
  logger.warn('NEXTAUTH_URL is not HTTPS in NODE_ENV=production; useSecureCookies will be false', {
    className: 'auth',
    methodName: 'module_init',
  });
}

function normalizeGoogleEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

// Absent profile or absent field: allow through -- state check already proved the Google identity.
// For email_verified: accept boolean true, or string 'true' (case-insensitive).
// Any other type (unexpected string, object, number) is treated as unverified.
function isEmailVerified(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return true;
  const val = profile.email_verified;
  if (val === undefined || val === null) return true;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return false;
}

function isPrismaRecordNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybePrismaError = error as { code?: string };
  return maybePrismaError.code === 'P2025';
}


// Custom adapter that bypasses the OAuthAccountNotLinked error.
//
// NextAuth v4 + PrismaAdapter throws OAuthAccountNotLinked when getUserByEmail
// finds an existing user but no linked OAuth account. We work around this by:
//   1. Always returning null from getUserByEmail so NextAuth takes the "new user"
//      code path for every OAuth sign-in (email-provider sign-in is unaffected
//      because the email provider does not call getUserByEmail in its verification flow).
//   2. Using upsert in createUser so existing email users are returned without a
//      unique-constraint error.
//   3. Using upsert in linkAccount so a duplicate Google account link is silently
//      updated rather than causing a constraint violation.
const _baseAdapter = PrismaAdapter(prisma);
const customAdapter = {
  ..._baseAdapter,
  getUserByEmail: async (_email: string) => null,
  createUser: async (data: { name?: string | null; email: string; emailVerified: Date | null; image?: string | null }) => {
    return prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        name: data.name ?? undefined,
        image: data.image ?? undefined,
        emailVerified: data.emailVerified,
        language: LanguageCode.en,
      },
    });
  },
  linkAccount: async (account: {
    userId: string;
    provider: string;
    providerAccountId: string;
    type: string;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  }) => {
    // Return the upserted account so callers receive the persisted record.
    return prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
      update: {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state,
      },
      create: {
        userId: account.userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        type: account.type,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state,
      },
    });
  },
  useVerificationToken: async (identifierToken: { identifier: string; token: string }) => {
    try {
      const verificationToken = await prisma.verificationToken.delete({
        where: { identifier_token: identifierToken },
      });

      if ('id' in verificationToken && verificationToken.id) {
        delete verificationToken.id;
      }

      return verificationToken;
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        try {
          const idHash = crypto.createHash('sha256').update(String(identifierToken.identifier)).digest('hex').slice(0, 8);
          logger.info('auth.verificationToken.alreadyConsumed', { identifierHash: idHash });
        } catch {
          logger.info('auth.verificationToken.alreadyConsumed', { identifierRedacted: true });
        }
        return null;
      }
      throw error;
    }
  },
};

export const authOptions: any = {
  adapter: customAdapter,
  useSecureCookies: isProd,
  pages: {
    signIn: '/auth/get-started',
    error: '/auth/error',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const emailInput = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!emailInput || !password) return null;
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: emailInput },
            select: { id: true, email: true, name: true, image: true, passwordHash: true, role: true },
          });
          if (!dbUser?.passwordHash) return null;
          const ok = await compare(password, dbUser.passwordHash);
          if (!ok) return null;
          return {
            id: dbUser.id,
            email: dbUser.email ?? emailInput,
            name: dbUser.name ?? undefined,
            image: dbUser.image ?? undefined,
          } as any;
        } catch (err) {
          logger.warn('credentials authorize failed', { className: 'auth', methodName: 'authorize', error: String(err) });
          return null;
        }
      },
    }),
    /*
      Email sign-in (magic link) disabled. To re-enable, uncomment imports
      at the top of this file and this provider block.

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
    */
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      // Validate Google identity claims before allowing sign-in.
      // User/account creation is handled by the custom adapter (createUser + linkAccount upserts).
      if (account?.provider === 'google') {
        const googleSubject = String(account.providerAccountId ?? (profile as any)?.sub ?? '').trim();
        const profileObject = (profile as Record<string, unknown> | null) ?? null;
        const email = normalizeGoogleEmail((profileObject as any)?.email ?? user?.email);

        // When profile is present, require email_verified.
        // When profile is absent (NextAuth edge case), PKCE+state already validated the
        // identity with Google -- allow through and rely on googleSubject + email checks.
        const emailVerifiedOk = profileObject === null ? true : isEmailVerified(profileObject);

        if (!googleSubject || !email || !emailVerifiedOk) {
          logger.warn('google signIn rejected due to missing verified identity claims', {
            className: 'auth',
            methodName: 'signIn',
            hasGoogleSubject: !!googleSubject,
            hasEmail: !!email,
            profilePresent: profileObject !== null,
            emailVerified: profileObject !== null ? isEmailVerified(profileObject) : 'n/a (profile absent)',
          });
          return false;
        }
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
                details: { legacyAction: 'student.login', board: curBoard, grade: curGrade },
              },
            });
          }
        }
      } catch (err) {
        logger.warn('signIn login-audit failed', { className: 'auth', methodName: 'signIn', error: String(err) });
      }
      // Emit signin analytics (best-effort)
      try {
        if (user?.email) {
          const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } }).catch(() => null);
          void emitServerAnalyticsEvent({
            eventType: ANALYTICS_EVENTS.STUDENT.AUTH_SIGNIN,
            userId: dbUser?.id ?? null,
            metadata: { provider: account?.provider ?? 'unknown' },
          }, 'auth.signIn');
        }
      } catch (emitErr) {
        logger.warn('auth: analytics emit failed', { className: 'auth', methodName: 'signIn', error: String(emitErr) });
      }
      return true;
    },
    async jwt({ token, user }: any) {
      const start = Date.now();
      if (user?.id) {
        token.id = user.id;
      }
      if (!token.id && token.sub) {
        token.id = token.sub;
      }

      if (token.email) {
        // Cache key for JWT session data. Any API route that writes role, accountStatus,
        // grade, board, language, or subjects MUST call invalidateUserSessionCache(email)
        // after the DB write to prevent stale auth state within the 30s TTL window.
        const cacheKey = `session:user:${String(token.email).toLowerCase()}`;
        let cacheHit = false;
        const redis = getRedis?.();
        if (redis) {
            try {
              const cached = await redis.get(cacheKey);
              if (cached) {
                const cachedObj = JSON.parse(cached);
                token.id = token.id ?? cachedObj.id;
                token.role = cachedObj.role;
                token.accountStatus = cachedObj.accountStatus ?? 'active';
                // Restore profile pieces used to deterministically compute onboarding
                token.grade = cachedObj.grade ?? undefined;
                token.board = cachedObj.board ?? undefined;
                token.language = cachedObj.language ?? undefined;
                token.subjects = cachedObj.subjects ?? undefined;
                // Recompute onboardingComplete the same way as DB path: profile complete
                // AND account active. Cached entries set by previous versions may have
                // ignored accountStatus, so re-derive here rather than trusting the cache.
                const cachedProfileComplete = !!(
                  token.grade && token.board && token.language &&
                  (Array.isArray(token.subjects) ? token.subjects.filter(Boolean).length > 0 : (typeof token.subjects === 'string' && token.subjects.length > 0))
                );
                token.onboardingComplete = cachedProfileComplete && token.accountStatus === 'active';
                cacheHit = true;
                logger.add('jwt.cache.hit', { className: 'auth', methodName: 'jwt', cacheKey });
                try { incJwtCacheHit(); } catch {}
              }
            } catch (cacheErr) {
              logger.warn('jwt cache read failed', { className: 'auth', methodName: 'jwt', error: String(cacheErr) });
            }
          }

        if (!cacheHit) {
          try { incJwtCacheMiss() } catch {}
          try {
            const dbStart = Date.now();
            // Select only the fields required to compute auth flags and reduce row width.
            // Keep grade/board/language/subjects so onboardingComplete can be derived
            // consistently on cache hit vs DB miss.
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
            // const dbEnd = Date.now();
            if (dbUser) {
              token.id = token.id ?? dbUser.id;
              token.role = dbUser.role;
              token.accountStatus = (dbUser as { accountStatus?: string }).accountStatus ?? 'active';

              // Resolve subjects from both array (standard Prisma) and Neon wire-format string "{a,b,c}"
              let subjectCount = 0;
              let subjectsVal: string[] | string | undefined = undefined;
              if (Array.isArray(dbUser.subjects)) {
                subjectsVal = dbUser.subjects as string[];
                subjectCount = (dbUser.subjects as string[]).filter(Boolean).length;
              } else if (typeof dbUser.subjects === 'string' && (dbUser.subjects as string).length > 0) {
                subjectsVal = dbUser.subjects as string;
                subjectCount = (dbUser.subjects as string)
                  .replace(/^\{/, '').replace(/\}$/, '').split(',')
                  .filter((s) => s.trim().length > 0).length;
              }

              // onboardingComplete requires BOTH a complete academic profile AND an
              // active account. A pending_parent_verification (or any non-active) status
              // must keep the user on the gate flow, even if profile fields are populated.
              const profileComplete = !!(
                dbUser.grade && dbUser.board && dbUser.language && subjectCount > 0
              );
              token.onboardingComplete = profileComplete && token.accountStatus === 'active';

              // Persist profile pieces on token so downstream server consumers can use them
              token.grade = dbUser.grade ?? undefined;
              token.board = dbUser.board ?? undefined;
              token.language = dbUser.language ?? undefined;
              token.subjects = subjectsVal;

              // Cache a lightweight shape for short TTL to reduce DB load. Include the
              // same profile pieces used to derive onboardingComplete so cache hits
              // are consistent with direct DB reads.
              if (redis) {
                try {
                  const toCache = {
                    id: dbUser.id,
                    role: dbUser.role,
                    accountStatus: dbUser.accountStatus ?? 'active',
                    grade: dbUser.grade ?? null,
                    board: dbUser.board ?? null,
                    language: dbUser.language ?? null,
                    subjects: subjectsVal ?? null,
                    onboardingComplete: token.onboardingComplete,
                  };
                  // short TTL (seconds)
                  await redis.set(cacheKey, JSON.stringify(toCache), 'EX', 30);
                  logger.add('jwt.cache.set', { className: 'auth', methodName: 'jwt', cacheKey, ttl: 30 });
                } catch (setErr) {
                  logger.warn('jwt cache set failed', { className: 'auth', methodName: 'jwt', error: String(setErr) });
                }
              }
            }
            logger.add('jwt.db.fetch', { className: 'auth', methodName: 'jwt', durationMs: Date.now() - dbStart});
          } catch (err) {
            logger.warn('jwt callback DB fetch failed, using defaults', { className: 'auth', methodName: 'jwt', error: String(err) });
            token.accountStatus = (token.accountStatus as string) ?? 'active';
            token.onboardingComplete = (token.onboardingComplete as boolean) ?? false;
          }
        }
      }

      // Reduce noisy logging: only emit timing when slow or sampled.
      try {
        const totalMs = Date.now() - start;
        if (totalMs > 50 || Math.random() < 0.01) {
          logger.add('jwt.timing', { className: 'auth', methodName: 'jwt', totalMs });
        }
      } catch (e) {
        // Log timing errors to avoid silent swallows and satisfy lint rules
        try {
          logger.warn('jwt.timing.log_failed', { className: 'auth', methodName: 'jwt', error: String(e) });
        } catch {
          // best-effort logging only
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

