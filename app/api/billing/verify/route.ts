import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { sendMail } from '@/lib/mailer';
import { paymentReceiptHtml } from '@/lib/email/templates';
import { logApiUsage } from '@/utils/logApiUsage';

async function sendPaymentSuccessEmail(
  to: string,
  name: string,
  plan: string,
  billingCycle: string,
  amount: number,
) {
  await sendMail({
    to,
    subject: 'Payment confirmed -- Spinzy Academy',
    html: paymentReceiptHtml({
      studentName: name,
      plan,
      amountRupees: amount,
      billingCycle,
      renewalDate: '',
    }),
  });
}

export async function POST(req: Request) {
  logApiUsage('/api/billing/verify', 'POST');
  const session = await getServerSessionForHandlers();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessionUser = session.user as SessionUser;

  const body = await req.json();
  const {
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
    billingCycle,
    amount,
  } = body;
  // Verify Razorpay signature
  const sign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_subscription_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (sign !== razorpay_signature) {
    // Record failed payment
    await prisma.payment.create({
      data: {
        userId: sessionUser.id!,
        amount: amount,
        provider: 'razorpay',
        status: 'failed',
        createdAt: new Date(),
        transactionId: razorpay_payment_id,
        orderId: razorpay_subscription_id,
        plan: String(plan),
        billingCycle: String(billingCycle),
        meta: { signature: razorpay_signature },
      },
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Create Payment record (successful)
  const payment = await prisma.payment.create({
    data: {
      userId: sessionUser.id!,
      amount: amount,
      provider: 'razorpay',
      status: 'success',
      createdAt: new Date(),
      transactionId: razorpay_payment_id,
      orderId: razorpay_subscription_id,
      plan: String(plan),
      billingCycle: String(billingCycle),
      meta: { signature: razorpay_signature },
    },
  });

  // Calculate subscription dates
  const startDate = new Date();
  const endDate =
    billingCycle === 'annual'
      ? new Date(new Date().setFullYear(startDate.getFullYear() + 1))
      : new Date(new Date().setMonth(startDate.getMonth() + 1));

  // Deactivate any existing subscriptions for this user
  await prisma.subscription.updateMany({
    where: { userId: sessionUser.id!, active: true },
    data: { active: false },
  });

  // Create new active subscription and link to payment
  await prisma.subscription.create({
    data: {
      userId: sessionUser.id!,
      plan: String(plan),
      billingCycle: String(billingCycle),
      startDate,
      endDate,
      active: true,
      paymentId: payment.id, // Link to payment record
    },
  });

  // Send payment success email
  try {
    await sendPaymentSuccessEmail(
      sessionUser.email!,
      sessionUser.name || '',
      String(plan),
      String(billingCycle),
      amount / 100, // Convert paise to rupees
    );
  } catch (err) {
    logger.error('Failed to send payment email', { className: 'api.billing.verify', methodName: 'POST', error: err });
  }

  return NextResponse.json({ success: true });
}
