/**
 * POST /api/student/subscription/verify
 *
 * Verifies Razorpay payment signature, activates subscription,
 * sends receipt email, and sends SMS if phone is available.
 * Auth: session required -- 401 before any DB query.
 * Idempotent: safe to retry if subscription is already active.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/mailer';
import { paymentReceiptHtml } from '@/lib/email/templates';
import { sendSms } from '@/lib/sms';
import { PLANS } from '@/lib/subscription/plans';
import type { PlanId } from '@/lib/subscription/plans';
import { createInvoiceForPayment } from '@/lib/invoices';

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature || '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const orderId = typeof b.orderId === 'string' ? b.orderId : '';
  const paymentId = typeof b.paymentId === 'string' ? b.paymentId : '';
  const signature = typeof b.signature === 'string' ? b.signature : '';
  const planId = typeof b.planId === 'string' ? b.planId : '';

  if (!orderId || !paymentId || !signature || !planId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['monthly', 'quarterly', 'annual'].includes(planId)) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  // Security gate -- verify signature before any DB write
  if (!verifySignature(orderId, paymentId, signature)) {
    logger.error('Invalid Razorpay signature', { event: 'subscription.verify.bad_sig', context: { userId, orderId } });
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  // Cross-check order belongs to this student
  const order = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId: orderId },
    select: { studentId: true, status: true, planMonths: true, providerIdempotencyKey: true },
  });
  if (!order || order.studentId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 403 });
  }

  const plan = PLANS[planId as PlanId];
  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + plan.durationMonths);

  try {
    // Idempotent transaction: update order, activate subscription and create Payment
    let _createdPayment: { id: string } | null = null;
    try {
      _createdPayment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (order.status !== 'paid') {
          await tx.paymentOrder.update({
            where: { razorpayOrderId: orderId },
            data: { status: 'paid', paidAt: now },
          });
        }

        await tx.user.update({
          where: { id: userId },
          data: { subscriptionStatus: 'active', subscriptionExpiry: expiry },
        });

        await tx.freeTierUsage
          .upsert({
            where: { studentId: userId },
            update: { periodStart: now, sessionsUsed: 0 },
            create: { studentId: userId, periodStart: now, sessionsUsed: 0 },
          })
          .catch((err) => { logger.warn('freeTierUsage.upsert failed', { event: 'subscription.verify.upsert', context: { userId }, error: String(err) }) });

        // Create a Payment record to persist transaction metadata
        const payment = await tx.payment.create({
          data: {
            userId,
            amount: order.amount,
            provider: 'razorpay',
            providerIdempotencyKey: order.providerIdempotencyKey ?? undefined,
            status: 'success',
            transactionId: paymentId,
            orderId: orderId,
            plan: plan.label,
            billingCycle: plan.perMonthDisplay,
            meta: { planId },
          },
        });

        // Audit event for subscription activation payment
        await tx.paymentEvent.create({ data: { paymentId: payment.id, userId, provider: 'razorpay', providerIdempotencyKey: order.providerIdempotencyKey ?? undefined, transactionId: paymentId, orderId, eventType: 'payment.subscription_verified', amount: order.amount, status: 'success', payload: { planId } } })

        return { id: payment.id };
      });
    } catch (err) {
      logger.error('Failed to activate subscription', { event: 'subscription.verify.activate_error', context: { userId, orderId }, err });
      return NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 });
    }
  } catch (err) {
    logger.error('Failed to activate subscription', { event: 'subscription.verify.activate_error', context: { userId, orderId }, err });
    return NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 });
  }

  // Fetch user for email/SMS -- not part of the transaction
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  const renewalDate = expiry.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Send receipt email -- non-blocking, never throws to caller
  if (user?.email) {
      try {
      // Create invoice PDF, attach to email and upload to R2 (best-effort)
      const invoiceResult = await createInvoiceForPayment({
        userId,
        paymentId: _createdPayment?.id,
        studentId: order.studentId,
        amountPaise: order.amount,
        planLabel: plan.label,
        billingCycle: plan.perMonthDisplay,
      });

      await sendEmail({
        to: user.email,
        subject: 'Payment confirmed -- Spinzy Academy',
        html: paymentReceiptHtml({
          studentName: user.name ?? 'Student',
          plan: plan.label,
          amountRupees: plan.billedRupees,
          billingCycle: plan.perMonthDisplay,
          renewalDate,
        }),
        attachments: [
          {
            filename: `invoice-${invoiceResult.invoiceNumber}.pdf`,
            content: invoiceResult.pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      } as any).catch((err: unknown) => {
        logger.error('Receipt email failed', { event: 'subscription.verify.email_error', context: { userId }, err });
      });
      } catch (err: unknown) {
      logger.error('Invoice generation/email failed', { event: 'subscription.verify.invoice_error', context: { userId, orderId }, err });
      // Fallback: send receipt without attachment
      sendEmail({
        to: user.email,
        subject: 'Payment confirmed -- Spinzy Academy',
        html: paymentReceiptHtml({
          studentName: user.name ?? 'Student',
          plan: plan.label,
          amountRupees: plan.billedRupees,
          billingCycle: plan.perMonthDisplay,
          renewalDate,
        }),
      }).catch((err2: unknown) => {
        logger.error('Receipt email fallback failed', { event: 'subscription.verify.email_error', context: { userId }, err: err2 });
      });
    }
  }

  // Send receipt SMS -- non-blocking
  if (user?.phone) {
    const smsText = `Hi ${user.name ?? ''}! Your Spinzy ${plan.label} plan is active. Happy learning! - Team Spinzy`;
    sendSms(user.phone, smsText).catch((err: unknown) => {
      logger.error('Receipt SMS failed', { event: 'subscription.verify.sms_error', context: { userId }, err });
    });
  }

  return NextResponse.json(
    { success: true, subscriptionExpiry: expiry.toISOString() },
    { status: 200 },
  );
}
