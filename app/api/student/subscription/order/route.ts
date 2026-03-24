/**
 * POST /api/student/subscription/order
 *
 * Creates a Razorpay order for the chosen subscription plan.
 * Returns orderId, amount (paise), currency, keyId.
 * Auth: session required -- 401 before any DB query.
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PLANS, rupeesToPaise } from '@/lib/subscription/plans';
import type { PlanId } from '@/lib/subscription/plans';
import Razorpay from 'razorpay';

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const VALID_PLAN_IDS: PlanId[] = ['monthly', 'quarterly', 'annual'];

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

  const planId = (body as { planId?: unknown })?.planId;
  if (typeof planId !== 'string' || !VALID_PLAN_IDS.includes(planId as PlanId)) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  const plan = PLANS[planId as PlanId];
  const amountPaise = rupeesToPaise(plan.billedRupees);

  const client = getRazorpayClient();
  if (!client) {
    logger.error('Razorpay keys not configured', { event: 'subscription.order.no_client', context: { userId } });
    return NextResponse.json({ error: 'Payment not available' }, { status: 503 });
  }

  try {
    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      notes: { studentId: userId, planId, durationMonths: String(plan.durationMonths) },
    });

    if (!order?.id) {
      throw new Error('Razorpay returned no order id');
    }

    // Persist order so verify can cross-check student ownership + plan
    await prisma.paymentOrder.create({
      data: {
        studentId: userId,
        razorpayOrderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
        planMonths: plan.durationMonths,
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
