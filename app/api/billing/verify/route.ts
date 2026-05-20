import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { recordPaymentEvent } from '@/lib/payments/audit';
import computeProratedCredit from '@/lib/subscription/proration';
import { SessionUser } from '@/lib/types';
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { paymentReceiptHtml } from '@/lib/email/templates';
import { logApiUsage } from '@/utils/logApiUsage';

async function sendPaymentSuccessEmail(
  to: string,
  name: string,
  plan: string,
  billingCycle: string,
  amount: number,
) {
  await sendEmailUnifiedSafe({
    mode: 'raw',
    delivery: 'best_effort',
    to,
    subject: 'Payment confirmed -- Spinzy Academy',
    html: paymentReceiptHtml({
      studentName: name,
      plan,
      amountRupees: amount,
      billingCycle,
      renewalDate: '',
    }),
    reason: 'payment_success',
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
  // Capture idempotency header if client provided one (used for both failure/success recording)
  const idempotencyHeader = (req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || '') as string;
  // Verify Razorpay signature
  const sign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_subscription_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (sign !== razorpay_signature) {
    // Capture idempotency header if client provided one
    const idempotencyHeader = (req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || '') as string;

    // Record failed payment
      const failedPayment = await prisma.payment.create({
        data: {
          userId: sessionUser.id!,
          amount: amount,
          provider: 'razorpay',
          providerIdempotencyKey: idempotencyHeader || undefined,
          status: 'failed',
          createdAt: new Date(),
          transactionId: razorpay_payment_id,
          orderId: razorpay_subscription_id,
          plan: String(plan),
          billingCycle: String(billingCycle),
          meta: { signature: razorpay_signature },
        },
      });

      // Audit event (best-effort)
      try {
        await recordPaymentEvent({
          paymentId: failedPayment.id,
          userId: sessionUser.id!,
          provider: 'razorpay',
          providerIdempotencyKey: idempotencyHeader || undefined,
          transactionId: razorpay_payment_id,
          orderId: razorpay_subscription_id,
          eventType: 'payment.failed.client_verify',
          amount,
          status: 'failed',
          payload: { signature: razorpay_signature },
        })
      } catch (err) {
        // Non-fatal
        logger.warn('recordPaymentEvent failed', { err })
      }
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Create Payment record (successful)
  const payment = await prisma.payment.create({
    data: {
      userId: sessionUser.id!,
      amount: amount,
      provider: 'razorpay',
      providerIdempotencyKey: idempotencyHeader || undefined,
      status: 'success',
      createdAt: new Date(),
      transactionId: razorpay_payment_id,
      orderId: razorpay_subscription_id,
      plan: String(plan),
      billingCycle: String(billingCycle),
      meta: { signature: razorpay_signature },
    },
  });

  // Audit event (best-effort)
  try {
    await recordPaymentEvent({
      paymentId: payment.id,
      userId: sessionUser.id!,
      provider: 'razorpay',
      providerIdempotencyKey: idempotencyHeader || undefined,
      transactionId: razorpay_payment_id,
      orderId: razorpay_subscription_id,
      eventType: 'payment.success.client_verify',
      amount,
      status: 'success',
    })
  } catch (err) {
    // non-fatal
    logger.warn('recordPaymentEvent failed', { err })
  }

  // Calculate subscription dates
  const startDate = new Date();
  const endDate =
    billingCycle === 'annual'
      ? new Date(new Date().setFullYear(startDate.getFullYear() + 1))
      : new Date(new Date().setMonth(startDate.getMonth() + 1));

  // Compute prorated credit from any existing active subscription (if present)
  let carryForwardCredit = 0;
  const existingSub = await prisma.subscription.findFirst({
    where: { userId: sessionUser.id!, active: true },
    select: { id: true, startDate: true, endDate: true, paymentId: true, creditBalance: true },
  });

  if (existingSub) {
    try {
      const paid = existingSub.paymentId
        ? await prisma.payment.findUnique({ where: { id: existingSub.paymentId }, select: { amount: true } })
        : null;
      const paidAmount = paid?.amount ?? 0;
      const proration = computeProratedCredit(existingSub.startDate!, existingSub.endDate!, paidAmount);
      const existingCredit = existingSub.creditBalance ?? 0;
      carryForwardCredit = (existingCredit || 0) + (proration || 0);
    } catch (err) {
      // Non-fatal -- proceed without proration if DB read fails
      logger.warn('proration calculation failed', { event: 'billing.verify.proration', context: { userId: sessionUser.id! }, err });
      carryForwardCredit = 0;
    }
  }

  // Deactivate any existing subscriptions for this user
  await prisma.subscription.updateMany({ where: { userId: sessionUser.id!, active: true }, data: { active: false } });

  // Create new active subscription and link to payment (persist any carry-forward credit)
  await prisma.subscription.create({
    data: {
      userId: sessionUser.id!,
      plan: String(plan),
      billingCycle: String(billingCycle),
      startDate,
      endDate,
      active: true,
      paymentId: payment.id, // Link to payment record
      creditBalance: carryForwardCredit,
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

/**
 * EDIT LOG:
 * - 2026-05-20T00:00:00Z | copilot | refactor: use centralized sendEmailUnifiedSafe (lib/mail), remove direct sendMail per infra policy
 */
