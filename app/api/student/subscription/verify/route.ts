/**
 * POST /api/student/subscription/verify
 *
 * Verifies Razorpay payment signature, activates subscription,
 * sends receipt email, and sends SMS if phone is available.
 * Auth: session required — 401 before any DB query.
 * Idempotent: safe to retry if subscription is already active.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/mailer';
import { sendSms } from '@/lib/sms';
import { PLANS } from '@/lib/subscription/plans';
import type { PlanId } from '@/lib/subscription/plans';

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

  // Security gate — verify signature before any DB write
  if (!verifySignature(orderId, paymentId, signature)) {
    logger.error('Invalid Razorpay signature', { event: 'subscription.verify.bad_sig', context: { userId, orderId } });
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  // Cross-check order belongs to this student
  const order = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId: orderId },
    select: { studentId: true, status: true, planMonths: true },
  });
  if (!order || order.studentId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 403 });
  }

  const plan = PLANS[planId as PlanId];
  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + plan.durationMonths);

  try {
    // Idempotent transaction
    await prisma.$transaction(async (tx) => {
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
        .catch(() => {});
    });
  } catch (err) {
    logger.error('Failed to activate subscription', { event: 'subscription.verify.activate_error', context: { userId, orderId }, err });
    return NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 });
  }

  // Fetch user for email/SMS — not part of the transaction
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  const renewalDate = expiry.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Send receipt email — non-blocking, never throws to caller
  if (user?.email) {
    sendEmail({
      to: user.email,
      subject: 'Your Spinzy subscription is active 🎉',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
          <h2 style="color:#534AB7;margin-bottom:8px;">You're all set, ${user.name ?? 'Student'}!</h2>
          <p style="color:#374151;">Your <strong>${plan.label}</strong> subscription is now active.</p>
          <table style="border-collapse:collapse;margin:16px 0;font-size:14px;color:#374151;">
            <tr><td style="padding:4px 12px 4px 0">Plan</td><td><strong>${plan.label} (${plan.perMonthDisplay})</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0">Billed today</td><td><strong>₹${plan.billedRupees}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0">Renews on</td><td>${renewalDate}</td></tr>
          </table>
          <p style="color:#6B7280;font-size:13px;">Questions? Reply to this email or reach us at support@spinzy.in</p>
          <p style="color:#374151;">Happy learning!<br><strong>Team Spinzy</strong></p>
        </div>
      `,
    }).catch((err) => {
      logger.error('Receipt email failed', { event: 'subscription.verify.email_error', context: { userId }, err });
    });
  }

  // Send receipt SMS — non-blocking
  if (user?.phone) {
    const smsText = `Hi ${user.name ?? ''}! Your Spinzy ${plan.label} plan is active. Happy learning! - Team Spinzy`;
    sendSms(user.phone, smsText).catch((err) => {
      logger.error('Receipt SMS failed', { event: 'subscription.verify.sms_error', context: { userId }, err });
    });
  }

  return NextResponse.json(
    { success: true, subscriptionExpiry: expiry.toISOString() },
    { status: 200 },
  );
}
