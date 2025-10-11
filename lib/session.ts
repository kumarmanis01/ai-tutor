import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Utility to get the current authenticated session user and subscription status.
 * Returns an object with user info, hasActiveSubscription, and subscription details.
 * Usage (in API routes):
 *   const { user, hasActiveSubscription, subscription } = await getSessionUserWithSubscription();
 *   if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function getSessionUserWithSubscription() {
  const session = await getServerSession(authOptions);
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
