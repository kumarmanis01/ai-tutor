import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SessionUser } from '@/lib/types';

/**
 * API endpoint: /api/billing/verify
 *
 * Verifies Razorpay payment signature and updates user's subscription in DB.
 * Also creates a Payment record for admin reporting.
 *
 * Steps:
 * 1. Checks if the user is authenticated.
 * 2. Receives payment details and signature from Razorpay.
 * 3. Verifies the payment signature using your Razorpay secret.
 * 4. If valid, creates a Payment record (status: 'success').
 * 5. Deactivates any existing active subscriptions for the user.
 * 6. Creates a new active subscription with the selected plan and billing cycle.
 * 7. Returns { success: true } if everything is successful, or an error if not.
 */
export async function POST(req: Request) {
  // Authenticate user
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

  // Parse request body
  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billingCycle, amount } =
    body;

  // Verify Razorpay signature
  const sign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (sign !== razorpay_signature) {
    // Record failed payment
    await prisma.payment.create({
      data: {
        userId: sessionUser.id,
        amount: amount / 100, // Convert from paise to rupees
        provider: 'razorpay',
        status: 'success',
        createdAt: new Date(),
        transactionId: razorpay_payment_id, // <-- comma here
        orderId: razorpay_order_id, // <-- comma here
        plan: String(plan), // <-- comma here
        billingCycle: String(billingCycle), // <-- comma here
        meta: { signature: razorpay_signature }, // <-- comma here
      },
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Calculate subscription dates
  const startDate = new Date();
  const endDate =
    billingCycle === 'monthly'
      ? new Date(new Date().setMonth(startDate.getMonth() + 1))
      : new Date(new Date().setFullYear(startDate.getFullYear() + 1));

  // Record successful payment
  await prisma.payment.create({
    data: {
      userId: sessionUser.id,
      amount: amount / 100, // Convert from paise to rupees
      provider: 'razorpay',
      status: 'success',
      createdAt: new Date(),
      transactionId: razorpay_payment_id,
      orderId: razorpay_order_id,
      plan: String(plan),
      billingCycle: String(billingCycle),
      meta: { signature: razorpay_signature },
    },
  });

  // Deactivate any existing subscriptions for this user
  await prisma.subscription.updateMany({
    where: { userId: sessionUser.id, active: true },
    data: { active: false },
  });

  // Create new active subscription
  await prisma.subscription.create({
    data: {
      userId: sessionUser.id,
      plan: String(plan),
      billingCycle: String(billingCycle),
      startDate,
      endDate,
      active: true,
    },
  });

  return NextResponse.json({ success: true });
}
