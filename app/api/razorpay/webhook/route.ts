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
 * - (none yet) - exercised indirectly by parent/student verify tests
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | added Razorpay webhook handler
 * - 2026-05-13T00:00:00Z | copilot | fix payment.captured analytics emission (remove invalid failure payload and duplicate success emit)
 * - 2026-05-14T00:00:00Z | copilot | update payment-failed emails to use centralized templates and support constant
 * - 2026-05-20T00:00:00Z | copilot | refactor: use centralized sendEmailUnifiedSafe (lib/mail), remove direct sendMailSafe per infra policy
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { parentPaymentFailedHtml } from '@/lib/email/templates';
import { sendSms } from '@/lib/sms';
import { getPaymentDunningQueue } from '@/jobs/paymentDunning';
import Razorpay from 'razorpay';
import { recordPaymentEvent } from '@/lib/payments/audit';
import { redeemReferral } from '@/lib/referral';
import { redeemCoupon } from '@/lib/coupon';
import { RAZORPAY_WEBHOOK_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

function getWebhookSecret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_KEY_SECRET ?? '';
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  // Support both ESM default export mocks and direct constructor exports
  const R = (Razorpay && (Razorpay as any).default) ? (Razorpay as any).default : Razorpay as any;
  if (typeof R !== 'function') return null;
  try {
    return new R({ key_id: keyId, key_secret: keySecret });
  } catch (err) {
    // Non-fatal in webhook processing: return null so we continue without fetching notes
    logger.warn('getRazorpayClient: could not instantiate razorpay client', { err });
    return null;
  }
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
        if (process.env.NODE_ENV === 'test') {
          logger.debug('webhook.notes (test)', { notes });
        }
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
          // Attempt auto-redemption for referral (if user was invited and this is their first paid event)
          try {
            const userRow = await tx.user.findUnique({ where: { id: orderRow.studentId }, select: { preferences: true } });
            const fromPrefs = (userRow?.preferences && typeof userRow.preferences === 'object') ? (userRow.preferences as any).referredBy : undefined
            const referralCode = fromPrefs || notes?.referralCode || notes?.ref
            if (typeof referralCode === 'string' && referralCode) {
              // Use purchaser IP saved in order notes to enable same-IP fraud detection
              const redeemerIp = typeof notes?.purchaserIp === 'string' && notes.purchaserIp ? notes.purchaserIp : (typeof notes?.purchaser_ip === 'string' && notes.purchaser_ip ? notes.purchaser_ip : (typeof notes?.buyerIp === 'string' && notes.buyerIp ? notes.buyerIp : (typeof notes?.buyer_ip === 'string' && notes.buyer_ip ? notes.buyer_ip : null)));
              const redeemRes = await redeemReferral(tx, referralCode, orderRow.studentId, redeemerIp)
              if (redeemRes.status !== 200) {
                logger.warn('auto-redeem referral returned non-200', { orderId, referralCode, res: redeemRes })
              }
            }

            // Coupon auto-redeem (if couponCode present in order notes). We already applied discount at order creation,
            // so record redemption but skip applying credit to avoid double-credits.
            try {
              const couponCode = typeof notes?.couponCode === 'string' && notes.couponCode ? notes.couponCode : (typeof notes?.coupon === 'string' && notes.coupon ? notes.coupon : undefined)
              if (couponCode) {
                const cres = await redeemCoupon(tx, couponCode, orderRow.studentId, undefined, { applyAsCredit: false })
                if (cres.status !== 200) logger.warn('auto-redeem coupon returned non-200', { orderId, couponCode, res: cres })
              }
            } catch (err) {
              logger.warn('auto-redeem coupon failed', { err, orderId })
            }
          } catch (err) {
            logger.warn('auto-redeem referral failed', { err, orderId })
          }
        } else {
          paymentRecordId = existing.id;
          // update existing payment status if needed
          if (existing.status !== 'success') {
            await tx.payment.update({ where: { id: existing.id }, data: { status: 'success', transactionId: paymentId, orderId, meta: { ...(existing.meta || {}), notes } } });
            await recordPaymentEvent(tx, { paymentId: existing.id, userId: orderRow.studentId, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, transactionId: paymentId, orderId, eventType: 'payment.updated.webhook', payload: { notes }, amount: payment.amount, status: 'success' })
            // If an existing failed/updated payment now became successful, also attempt referral redemption
              try {
                const userRow = await tx.user.findUnique({ where: { id: orderRow.studentId }, select: { preferences: true } });
                const fromPrefs = (userRow?.preferences && typeof userRow.preferences === 'object') ? (userRow.preferences as any).referredBy : undefined
                const referralCode = fromPrefs || notes?.referralCode || notes?.ref
                if (typeof referralCode === 'string' && referralCode) {
                  const redeemerIp = typeof notes?.purchaserIp === 'string' && notes.purchaserIp ? notes.purchaserIp : (typeof notes?.purchaser_ip === 'string' && notes.purchaser_ip ? notes.purchaser_ip : (typeof notes?.buyerIp === 'string' && notes.buyerIp ? notes.buyerIp : (typeof notes?.buyer_ip === 'string' && notes.buyer_ip ? notes.buyer_ip : null)));
                  const redeemRes = await redeemReferral(tx, referralCode, orderRow.studentId, redeemerIp)
                  if (redeemRes.status !== 200) {
                    logger.warn('auto-redeem referral returned non-200 (updated payment)', { orderId, referralCode, res: redeemRes })
                  }
                }
              } catch (err) {
                logger.warn('auto-redeem referral failed (updated payment)', { err, orderId })
              }
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

      // Analytics: payment succeeded (best-effort)
      try {
        void emitServerAnalyticsEvent({
          eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_SUCCESS,
          userId: orderRow.studentId,
          metadata: { orderId, paymentId, amount: payment?.amount },
        }, 'razorpay.webhook.payment.captured')
      } catch (err) {
        logger.warn('Failed to emit payment success analytics from webhook', { err, orderId, paymentId })
      }

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

      // Attempt to fetch Razorpay order notes (to identify subscription/installment metadata)
      const client = getRazorpayClient();
      let notes: any = {};
      if (client) {
        try { const rzOrder = await client.orders.fetch(orderId); notes = rzOrder?.notes || {}; } catch (err) { logger.warn('Could not fetch rz order in webhook (failed)', { orderId, err }); }
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

        let _paymentRecordId: string | null = null;
        if (!existing) {
          const newPayment = await tx.payment.create({ data: { userId: orderRow.studentId, amount: payment?.amount ?? orderRow.planMonths ?? 0, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, status: 'failed', transactionId: paymentId, orderId, meta: { reason } } });
          _paymentRecordId = newPayment.id;
          await recordPaymentEvent(tx, { paymentId: newPayment.id, userId: orderRow.studentId, provider: 'razorpay', providerIdempotencyKey: idempotencyHeader || undefined, transactionId: paymentId, orderId, eventType: 'payment.failed.webhook', payload: { reason }, amount: payment?.amount ?? orderRow.planMonths ?? 0, status: 'failed' })
        } else {
          _paymentRecordId = existing.id;
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
        const _subject = `Payment failed -- action required`;
        const { MAIL_SUPPORT } = await import('@/lib/constants/mail').catch(() => ({ MAIL_SUPPORT: RAZORPAY_WEBHOOK_SUPPORT_EMAIL }));
        const _html = parentPaymentFailedHtml({ name: parent.name ?? undefined, retryUrl: retryLink, supportEmail: process.env.SUPPORT_EMAIL ?? MAIL_SUPPORT });
        await sendEmailUnifiedSafe({
          mode: 'raw',
          delivery: 'best_effort',
          to: parent.email,
          subject: 'Payment failed -- Spinzy Academy',
          html: parentPaymentFailedHtml({ studentName: parent.name ?? undefined, amount: payment?.amount ?? orderRow.planMonths ?? 0 }),
          reason: 'payment_failed',
        });
      }
      if (parent?.phone) {
        await sendSms(parent.phone, `Payment failed for your Spinzy subscription. Update payment: ${retryLink}`);
      }

      try {
        const q = getPaymentDunningQueue();
        // Enqueue a payment-level dunning job. Tests mock getPaymentDunningQueue and
        // expect an enqueue call for failed webhooks.
        await q.add('payment-dunning', { notes: notes || {}, orderId, paymentId }, { removeOnComplete: true });
      } catch (err) {
        logger.error('Failed to enqueue payment dunning job from webhook', { err });
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
