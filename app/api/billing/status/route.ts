import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { logApiUsage } from '@/utils/logApiUsage';

/**
 * Returns the user's current subscription status.
 * Purpose:
Returns the current user's subscription status (plan, billing cycle, validity).
How:
Checks if the user is authenticated.
Gets the user’s ID from the session or database.
Finds the latest active subscription for the user.
Returns plan, billing cycle, status, and validity date.
Typical Response:
{ plan: 'pro', billingCycle: 'monthly', status: 'active', validTill: '2025-12-31' }
 */
export async function GET() {
  logApiUsage('/api/billing/status ', 'GET');
  const session = await getServerSessionForHandlers();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;
  if (!sessionUser || !sessionUser.email) {
    return NextResponse.json({ plan: 'free', status: 'inactive' });
  }

  // Get userId from session or fetch by email
  let userId = sessionUser.id;
  if (!userId) {
    const savedUser = await prisma.user.findUnique({
      where: { email: sessionUser.email },
    });
    userId = savedUser?.id;
  }
  if (!userId) {
    return NextResponse.json({ plan: 'free', status: 'inactive' });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    return NextResponse.json({ plan: 'free', status: 'inactive' });
  }

  return NextResponse.json({
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    status: subscription.active ? 'active' : 'inactive',
    validTill: subscription.endDate,
  });
}
