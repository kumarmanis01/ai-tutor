import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { SessionUser } from '@/lib/types';

/**
 * Verifies Razorpay payment signature and updates user's subscription in DB.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;
  if (!sessionUser || !sessionUser.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!sessionUser.id) {
    return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
  }

  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  // Verify signature
  const sign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (sign !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Update subscription in DB
  const plan = body.plan || 'pro';
  const billingCycle = body.billingCycle || 'monthly';

  const startDate = new Date();
  const endDate =
    billingCycle === 'monthly'
      ? new Date(new Date().setMonth(startDate.getMonth() + 1))
      : new Date(new Date().setFullYear(startDate.getFullYear() + 1));

  // Deactivate any existing subscriptions for this user
  await prisma.subscription.updateMany({
    where: { userId: sessionUser.id, active: true },
    data: { active: false },
  });
  // Create new active subscription
  await prisma.subscription.create({
    data: {
      userId: sessionUser.id, // Now guaranteed to be string
      plan: String(plan),
      billingCycle: String(billingCycle),
      startDate,
      endDate,
      active: true,
    },
  });

  return NextResponse.json({ success: true });
}
