import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { razorpay } from '@/lib/payments';
import { SessionUser } from '@/lib/types';
import { logger } from '@/lib/logger';
import { BILLING_MONTHLY, RAZORPAY_PLAN_IDS } from '../constants';
import { logApiUsage } from '@/utils/logApiUsage';

/**
 * Creates a Razorpay subscription for the selected plan.
 * Requires user to be signed in.
 * Purpose:
 *  Creates a Razorpay subscription for a selected plan and billing cycle.
 * How:
 *  Checks if the user is authenticated.
 *  Reads plan and billingCycle from the request body.
 *  Calls Razorpay API to create a subscription.
 *  Returns subscription ID, plan details, and user email.
 * Error Handling:
 *  Returns a 400 error for invalid plans.
 */

export async function POST(req: Request) {
  logApiUsage('/api/billing/checkout', 'POST');
  const session = await getServerSession(authOptions);
  if (!session) {
    logger.add('Unauthorized: No session found.');
    return new Response('Unauthorized', { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user || !user.email) {
    logger.add('Not authenticated: No user or email found in session.');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  logger.add('User authenticated: ' + JSON.stringify({ email: user.email }));

  const { plan, billingCycle } = await req.json();
  logger.add('Received options from UI: ' + JSON.stringify({ plan, billingCycle }));

  // Use constants for plan and billing cycle
  const planId = RAZORPAY_PLAN_IDS[plan]?.[billingCycle];
  if (!planId) {
    logger.add('Invalid plan or billing cycle received: ' + JSON.stringify({ plan, billingCycle }));
    return NextResponse.json({ error: 'Invalid plan or billing cycle' }, { status: 400 });
  }

  logger.add('Creating Razorpay subscription with planId: ' + planId);

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: billingCycle === BILLING_MONTHLY ? 12 : 1, // Use constant for monthly
    quantity: 1,
    notes: {
      email: user.email,
      plan,
      billingCycle,
    },
  });

  logger.add('Razorpay subscription created: ' + JSON.stringify(subscription));
  return NextResponse.json({
    subscriptionId: subscription.id,
    plan,
    billingCycle,
    email: user.email,
  });
}
