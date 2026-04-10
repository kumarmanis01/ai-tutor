/**
 * POST /api/razorpay/webhook
 *
 * Generic Razorpay webhook receiver. Verifies signature and processes
 * `payment.captured` events to reconcile orders that were not confirmed
 * via client-side verification. This supports both student and parent flows.
 *
 * FILE OBJECTIVE:
 * - Provide a webhook endpoint to handle Razorpay asynchronous events.
 *
 * LINKED UNIT TEST:
 * - (none yet) – exercised indirectly by parent/student verify tests
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | added Razorpay webhook handler
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendMailSafe } from '@/lib/mailer';
import { sendSms } from '@/lib/sms';
import { getPaymentDunningQueue } from '@/jobs/paymentDunning';
import { getInstallmentDunningQueue } from '@/jobs/installmentDunning';
import Razorpay from 'razorpay';
import { recordPaymentEvent } from '@/lib/payments/audit';

function getWebhookSecret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_KEY_SECRET ?? '';
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const idempotencyHeader = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || req.headers.get('x-idempotency') || '';
  const signature = req.headers.get('x-razorpay-signature') || '';
  const secret = getWebhookSecret();
  if (!secret || !signature) {
    logger.error('Missing webhook secret or signature');
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.error('Invalid Razorpay webhook signature', { event: 'webhook.bad_sig' });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch (err) { logger.warn('Invalid webhook payload JSON', { err }); return NextResponse.json({ ok: true }, { status: 200 }); }

  const ev = payload?.event;
  if (ev === 'payment.captured') {
    try {
      const payment = payload?.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      if (!orderId || !paymentId) return NextResponse.json({ ok: true }, { status: 200 });

      // Audit: webhook received
      try {
        await recordPaymentEvent({
          provider: 'razorpay',
          providerIdempotencyKey: idempotencyHeader || undefined,
          transactionId: paymentId,
          orderId,
          eventType: 'webhook.received',
          payload,
        })
      } catch (err) {
        logger.warn('Failed to write webhook.received event', { err })
      }

      const orderRow = await prisma.paymentOrder.findUnique({ where: { razorpayOrderId: orderId }, select: { studentId: true, status: true } });
      if (!orderRow) {
        logger.warn('Webhook payment.captured for unknown order', { orderId });
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      if (orderRow.status === 'paid') {
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      // Fetch notes from Razorpay order and attempt activation (best-effort)
      const client = getRazorpayClient();
      let notes: any = {};
      if (client) {
        try { const rzOrder = await client.orders.fetch(orderId); notes = rzOrder?.notes || {}; } catch (err) { logger.warn('Could not fetch rz order in webhook', { orderId, err }); }
      }

      const childIds = notes?.childIds ? (() => { try { return JSON.parse(notes.childIds); } catch { return [] } })() : [];
      const now = new Date();

      // Reconciliation: mark order paid and create/update a Payment record (idempotent)
      await prisma.$transaction(async (tx) => {
        await tx.paymentOrder.update({ where: { razorpayOrderId: orderId }, data: { status: 'paid', paidAt: now } });

        // Try to find existing payment by transactionId or idempotency key
        let existing = null as any;
        if (paymentId) {
          existing = await tx.payment.findFirst({ where: { provider: 'razorpay', transactionId: paymentId } });
        }
        if (!existing && idempotencyHeader) {
          existing = await tx.payment.findFirst({ where: { provider: 'razorpay', providerIdempotencyKey: idempotencyHeader } });
        }

        let paymentRecordId: string | null = null;
        if (!existing) {
          // create payment record
          const newPayment = await tx.payment.create({ data: { userId: orderRow.studentId, amount: payment.amount, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, status: 'success', transactionId: paymentId, orderId, meta: { notes } } });
          paymentRecordId = newPayment.id;
          // Log event in the same transaction
          await recordPaymentEvent(tx, { paymentId: newPayment.id, userId: orderRow.studentId, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, transactionId: paymentId, orderId, eventType: 'payment.created.webhook', payload: { notes }, amount: payment.amount, status: 'success' })
        } else {
          paymentRecordId = existing.id;
          // update existing payment status if needed
          if (existing.status !== 'success') {
            await tx.payment.update({ where: { id: existing.id }, data: { status: 'success', transactionId: paymentId, orderId, meta: { ...(existing.meta || {}), notes } } });
            await recordPaymentEvent(tx, { paymentId: existing.id, userId: orderRow.studentId, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, transactionId: paymentId, orderId, eventType: 'payment.updated.webhook', payload: { notes }, amount: payment.amount, status: 'success' })
          }
        }

        // If this payment was for an installment (notes contain subscriptionId & installmentNumber), reconcile Installment row
        try {
          const subscriptionId = notes?.subscriptionId || notes?.subscription_id || notes?.subscription;
          const installmentNumberRaw = notes?.installmentNumber || notes?.installment_no || notes?.installment || notes?.installmentIndex || notes?.installment_index;
          const installmentNumber = installmentNumberRaw ? Number(installmentNumberRaw) : null;
          if (subscriptionId && installmentNumber) {
            const inst = await tx.installment.findUnique({ where: { subscriptionId_number: { subscriptionId: String(subscriptionId), number: Number(installmentNumber) } } });
            if (inst) {
              await tx.installment.update({ where: { id: inst.id }, data: { status: 'PAID', providerPaymentId: paymentId, paymentId: paymentRecordId ?? undefined, paidAt: now, attemptCount: { increment: 1 } } });
            }
          }
        } catch (err) {
          // Non-fatal: log and continue
          logger.warn('Failed to reconcile installment on payment.captured', { err, orderId, paymentId });
        }

        // If childIds present, attempt to activate child subscriptions similarly to verify endpoint
        if (Array.isArray(childIds) && childIds.length > 0) {
          const planMonths = Number(notes?.durationMonths) || 1;
          const expiry = new Date(now);
          expiry.setMonth(expiry.getMonth() + planMonths);
          for (const sid of childIds) {
            await tx.user.update({ where: { id: sid }, data: { subscriptionStatus: 'active', subscriptionExpiry: expiry } });
          }
        }
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      logger.error('Webhook processing failed', { err });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  if (ev === 'payment.failed') {
    try {
      const payment = payload?.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      const reason = payment?.error_reason || payment?.error_description || null;
      if (!orderId || !paymentId) return NextResponse.json({ ok: true }, { status: 200 });

      const orderRow = await prisma.paymentOrder.findUnique({ where: { razorpayOrderId: orderId }, select: { studentId: true, status: true, planMonths: true } });
      if (!orderRow) {
        logger.warn('Webhook payment.failed for unknown order', { orderId });
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      if (orderRow.status === 'failed') {
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.paymentOrder.update({ where: { razorpayOrderId: orderId }, data: { status: 'failed' } });

        // Try to reconcile existing payment by transactionId or idempotency key
        let existing = null as any;
        if (paymentId) {
          existing = await tx.payment.findFirst({ where: { provider: 'razorpay', transactionId: paymentId } });
        }
        if (!existing && idempotencyHeader) {
          existing = await tx.payment.findFirst({ where: { provider: 'razorpay', providerIdempotencyKey: idempotencyHeader } });
        }

        let paymentRecordId: string | null = null;
        if (!existing) {
          const newPayment = await tx.payment.create({ data: { userId: orderRow.studentId, amount: payment?.amount ?? orderRow.planMonths ?? 0, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, status: 'failed', transactionId: paymentId, orderId, meta: { reason } } });
          paymentRecordId = newPayment.id;
          await recordPaymentEvent(tx, { paymentId: newPayment.id, userId: orderRow.studentId, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, transactionId: paymentId, orderId, eventType: 'payment.failed.webhook', payload: { reason }, amount: payment?.amount ?? orderRow.planMonths ?? 0, status: 'failed' })
        } else {
          paymentRecordId = existing.id;
          if (existing.status !== 'failed') {
            await tx.payment.update({ where: { id: existing.id }, data: { status: 'failed', meta: { ...(existing.meta || {}), reason } } });
            await recordPaymentEvent(tx, { paymentId: existing.id, userId: orderRow.studentId, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, transactionId: paymentId, orderId, eventType: 'payment.updated_failed.webhook', payload: { reason }, amount: payment?.amount ?? orderRow.planMonths ?? 0, status: 'failed' })
          }
        }

        // If this failed payment corresponds to an Installment, update the installment row (attemptCount/status)
        try {
          const subscriptionId = notes?.subscriptionId || notes?.subscription_id || notes?.subscription;
          const installmentNumberRaw = notes?.installmentNumber || notes?.installment_no || notes?.installment || notes?.installmentIndex || notes?.installment_index;
          const installmentNumber = installmentNumberRaw ? Number(installmentNumberRaw) : null;
          if (subscriptionId && installmentNumber) {
            const inst = await tx.installment.findUnique({ where: { subscriptionId_number: { subscriptionId: String(subscriptionId), number: Number(installmentNumber) } } });
            if (inst) {
              await tx.installment.update({ where: { id: inst.id }, data: { status: 'FAILED', attemptCount: { increment: 1 }, lastAttemptAt: now } });
            }
          } else {
            // Fallback to subscription-level dunning seed if no installment found
            const sub = await tx.subscription.findFirst({ where: { userId: orderRow.studentId, active: true } });
            if (sub) {
              await tx.subscription.update({ where: { id: sub.id }, data: { dunningAttempts: { increment: 1 }, lastDunningAt: now } });
            }
          }
        } catch (err) {
          logger.warn('Failed to update installment on payment.failed', { err, orderId, paymentId });
        }
      });

      // Notify parent (best-effort) and enqueue dunning job to run immediately (installment-level preferred)
      const parent = await prisma.user.findUnique({ where: { id: orderRow.studentId }, select: { id: true, email: true, phone: true, name: true } });
      const retryLink = `${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`;
      if (parent?.email) {
        const subject = `Payment failed — action required`;
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We couldn't complete your recent payment. Please update your payment method and retry here: <a href="${retryLink}">Update payment</a>. If you need help, contact ${process.env.SUPPORT_EMAIL ?? 'support@spinzyacademy.com'}.</p>`;
        await sendMailSafe({ to: parent.email, subject, html });
      }
      if (parent?.phone) {
        await sendSms(parent.phone, `Payment failed for your Spinzy subscription. Update payment: ${retryLink}`);
      }

      try {
        const q = getInstallmentDunningQueue();
        // When webhook receives a failed payment for an installment, enqueue an immediate installment retry job.
        // We pass notes so the worker can identify the installment if present.
        await q.add('installment-dunning', { notes: notes || {}, orderId, paymentId }, { removeOnComplete: true });
      } catch (err) {
        logger.error('Failed to enqueue installment dunning job from webhook', { err });
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      logger.error('Webhook payment.failed processing failed', { err });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  // For other events, acknowledge
  return NextResponse.json({ ok: true }, { status: 200 });
}

export default POST;
