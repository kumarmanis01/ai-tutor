import { getServerSession } from 'next-auth/next';
import type { AppSession } from '@/lib/types/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Session utilities
 *
 * Guidelines:
 * - For server-side handlers (API routes, server components) prefer using
 *   `getServerSessionForHandlers()` exported below. This centralizes the
 *   import of `authOptions` and makes it easy to change session behavior
 *   in one place.
 * - For client-side code (browser components), use `useSession()` from
 *   `next-auth/react` or the app's `useCurrentUser()` hook which fetches
 *   the canonical `User` via `/api/user/profile`.
 * - Do NOT call `getServerSession()` directly from many files. Use the
 *   helper so session acquisition remains consistent and maintainable.
 */

/**
 * Utility to get the current authenticated session user and subscription status.
 * Returns an object with user info, hasActiveSubscription, and subscription details.
 * Usage (in API routes):
 *   const { user, hasActiveSubscription, subscription } = await getSessionUserWithSubscription();
 *   if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function getSessionUserWithSubscription() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  const user = session?.user ?? null;

  if (!user?.id) {
    return { user: null, hasActiveSubscription: false, subscription: null };
  }

  // Find the user's active paid subscription (not free)
  // Subscription model fields: plan, billingCycle, startDate, endDate, active
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      active: true,
      startDate: { lte: now },
      endDate: { gte: now },
      plan: { not: 'free' }, // Only paid plans
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasActiveSubscription = !!subscription;

  return { user, hasActiveSubscription, subscription };
}

// Lightweight wrapper so other server handlers can use a single source
// of truth for acquiring NextAuth session without importing authOptions
export async function getServerSessionForHandlers() {
  // In tests we allow injecting a fake session via global.__TEST_SESSION__.
  // Use property presence so tests can set `__TEST_SESSION__ = null` to simulate
  // an unauthenticated request without calling the real NextAuth helper.
  const g: any = globalThis as any;
  if (Object.prototype.hasOwnProperty.call(g, '__TEST_SESSION__')) {
    return g.__TEST_SESSION__
  }
  return getServerSession(authOptions);
}

/**
 * Returns the session ONLY when the caller has role === 'parent' and an active
 * account, otherwise null. Centralizes the role check so every /api/parent/*
 * route can do a single guarded call instead of re-implementing the check
 * (and forgetting to). Pair with a 403 response when null is returned.
 */
export async function getParentSessionForHandlers() {
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string; role?: string; accountStatus?: string } | undefined;
  if (!user?.id) return null;
  if (user.role !== 'parent') return null;
  if (user.accountStatus && user.accountStatus !== 'active') return null;
  return session;
}

/**
 * Returns the session ONLY when the caller has role === 'user' (student) and
 * an active account, otherwise null. Use in /api/student/* routes that must
 * never be hit by a parent or admin account.
 */
export async function getStudentSessionForHandlers() {
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string; role?: string; accountStatus?: string } | undefined;
  if (!user?.id) return null;
  if (user.role !== 'user') return null;
  if (user.accountStatus && user.accountStatus !== 'active') return null;
  return session;
}
