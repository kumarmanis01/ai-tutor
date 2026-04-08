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
import Razorpay from 'razorpay';

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

      // Simple activation: mark order paid and create a Payment record; do not duplicate heavy flows
      await prisma.$transaction(async (tx) => {
        await tx.paymentOrder.update({ where: { razorpayOrderId: orderId }, data: { status: 'paid', paidAt: now } });
        const paymentRow = await tx.payment.create({ data: { userId: orderRow.studentId, amount: payment.amount, provider: 'razorpay', status: 'success', transactionId: paymentId, orderId, meta: { notes } } });

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

  // For other events, acknowledge
  return NextResponse.json({ ok: true }, { status: 200 });
}

export default POST;
