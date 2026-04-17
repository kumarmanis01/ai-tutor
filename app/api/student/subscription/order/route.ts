/**
 * POST /api/student/subscription/order
 *
 * Creates a Razorpay order for the chosen subscription plan.
 * Supports optional EMI selection for eligible plans (annual: 3/6/12).
 * Returns orderId, amount (paise), currency, keyId.
 * Auth: session required -- 401 before any DB query.
 *
 * FILE OBJECTIVE:
 * - Create Razorpay order for student subscription purchases with EMI support.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/subscription/order.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T05:20:00Z | copilot | add EMI support to student subscription order route
 * - 2026-04-17T12:00:00Z | copilot | include couponCode in Razorpay order notes and persist couponCode on PaymentOrder
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PLANS, rupeesToPaise } from '@/lib/billing/plans';
import { validateCoupon } from '@/lib/coupon'
import type { PlanId } from '@/lib/billing/plans';
import Razorpay from 'razorpay';

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const VALID_PLAN_IDS: PlanId[] = Object.keys(PLANS) as PlanId[];

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
  const planId = typeof b.planId === 'string' ? b.planId : '';
  const emiMonths = typeof b.emiMonths === 'number' ? b.emiMonths : undefined;

  if (typeof planId !== 'string' || !VALID_PLAN_IDS.includes(planId as PlanId)) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  // EMI is only allowed for annual plan and only for specific tenors
  if (emiMonths && planId !== 'annual') {
    return NextResponse.json({ error: 'EMI is only available for annual plan' }, { status: 400 });
  }
  if (emiMonths && ![3, 6, 12].includes(emiMonths)) {
    return NextResponse.json({ error: 'Invalid emiMonths (allowed: 3,6,12)' }, { status: 400 });
  }

  const plan = PLANS[planId as PlanId];
  const amountPaise = rupeesToPaise(plan.billedRupees);

  // Extract client IP for fraud checks and to store with the order notes so
  // webhooks can use the same IP when auto-redeeming referrals.
  function getClientIp(req: Request): string | null {
    try {
      // Standard proxy header
      const forwarded = req.headers.get('x-forwarded-for');
      if (forwarded) return forwarded.split(',')[0].trim();
      return req.headers.get('x-real-ip') ?? null;
    } catch (err) {
      return null;
    }
  }

  const purchaserIp = getClientIp(req);

  // If this user was referred and the referral is still available, apply 20% off first month
  let finalAmount = amountPaise
  try {
    const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } })
    const refCode = (userRow?.preferences && typeof userRow.preferences === 'object') ? (userRow.preferences as any).referredBy : undefined
    if (typeof refCode === 'string' && refCode) {
      // Only apply discount for monthly-duration plans (first month)
      if ((plan.durationMonths || 0) === 1) {
        // Verify referral exists and is not already redeemed
        const r = await prisma.referral.findUnique({ where: { code: refCode }, select: { redeemedBy: true } })
        if (r && !r.redeemedBy) {
          const discount = Math.floor(amountPaise * 0.2)
          finalAmount = Math.max(1, amountPaise - discount)
        }
      }
    }
  } catch (err) {
    // Non-fatal; proceed with full amount
    logger.warn('referral discount check failed', { err: String(err) })
  }

  // Optional coupon code from client — validate and apply discount (do not mark redeemed yet)
  const couponCode = typeof b.couponCode === 'string' ? (b.couponCode as string).trim() : undefined
  if (couponCode) {
    try {
      const v = await validateCoupon(prisma as any, couponCode, userId)
      if (v.status !== 200 || !v.body.coupon) {
        return NextResponse.json({ error: 'invalid_coupon', detail: v.body.error }, { status: 400 })
      }
      const c: any = v.body.coupon
      if (c.type === 'FIXED') {
        const discount = Number(c.amount) ?? 0
        finalAmount = Math.max(1, finalAmount - discount)
      } else {
        // percent
        const pct = Number(c.amount) ?? 0
        const discount = Math.floor(amountPaise * (pct / 100))
        finalAmount = Math.max(1, finalAmount - discount)
      }
    } catch (err) {
      logger.warn('coupon validation failed', { err: String(err), userId, couponCode })
      return NextResponse.json({ error: 'coupon_validation_error' }, { status: 400 })
    }
  }

  const client = getRazorpayClient();
  if (!client) {
    logger.error('Razorpay keys not configured', { event: 'subscription.order.no_client', context: { userId } });
    return NextResponse.json({ error: 'Payment not available' }, { status: 503 });
  }

  try {
    const userPrefs = (await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }))?.preferences ?? undefined;
    const order = await client.orders.create({
      amount: finalAmount,
      currency: 'INR',
      notes: {
        studentId: userId,
        planId,
        durationMonths: String(plan.durationMonths),
        emiMonths: emiMonths ? String(emiMonths) : '',
        referralCode: userPrefs && typeof userPrefs === 'object' ? (userPrefs as any).referredBy ?? '' : '',
        purchaserIp: purchaserIp ?? '',
        couponCode: couponCode ?? '',
      },
    });

    if (!order?.id) {
      throw new Error('Razorpay returned no order id');
    }

    // Persist order so verify can cross-check student ownership + plan
    await prisma.paymentOrder.create({
      data: {
        studentId: userId,
        razorpayOrderId: order.id,
        // Persist the actual amount we sent to Razorpay (may include referral discount)
        amount: finalAmount,
        currency: 'INR',
        status: 'created',
        planMonths: plan.durationMonths,
        planId: planId,
        couponCode: couponCode ?? null,
      },
    });

    return NextResponse.json(
      {
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID ?? '',
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error('Failed to create Razorpay order', { event: 'subscription.order.error', context: { userId, planId }, err });
    return NextResponse.json({ error: 'Could not create order' }, { status: 500 });
  }
}
