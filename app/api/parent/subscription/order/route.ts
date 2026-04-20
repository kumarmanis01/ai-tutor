/**
 * POST /api/parent/subscription/order
 *
 * Creates a Razorpay order for a parent-initiated subscription purchase.
 * Supports single-child purchases and family pricing (3 children at 1.8x).
 * Auth: session required and role must be `parent`.
 *
 * FILE OBJECTIVE:
 * - Create a server route to generate Razorpay orders for parent purchases.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created parent order endpoint
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PLANS, rupeesToPaise } from '@/lib/billing/plans';
import type { PlanId } from '@/lib/billing/plans';
import Razorpay from 'razorpay';

const VALID_PLAN_IDS: PlanId[] = Object.keys(PLANS) as PlanId[];

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const user = (session?.user as { id?: string; role?: string }) ?? null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const planId = typeof b.planId === 'string' ? b.planId : '';
  const childIds = Array.isArray(b.childIds) ? (b.childIds as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const isFamily = Boolean(b.isFamily);
  const emiMonths = typeof b.emiMonths === 'number' ? b.emiMonths : undefined;

  if (!planId || !VALID_PLAN_IDS.includes(planId as PlanId)) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  if (!childIds || childIds.length === 0 || childIds.length > 3) {
    return NextResponse.json({ error: 'Invalid childIds (must select 1-3 children)' }, { status: 400 });
  }

  // Family pricing allowed for up to 3 children
  if (isFamily && childIds.length > 3) {
    return NextResponse.json({ error: 'Family pricing allows up to 3 children' }, { status: 400 });
  }

  // Verify parent-child links
  const links = await prisma.parentStudent.findMany({ where: { parentId: user.id, studentId: { in: childIds }, status: 'active' }, select: { studentId: true } });
  if (links.length !== childIds.length) {
    return NextResponse.json({ error: 'One or more children are not linked to you' }, { status: 403 });
  }

  const plan = PLANS[planId as PlanId];

  // Pricing rules:
  // - Individual purchase: plan.billedRupees per child
  // - Multiple non-family children: plan.billedRupees × n
  // - Family pricing (3 children): 1.8 × single-child price
  let totalRupees = plan.billedRupees * childIds.length;
  if (isFamily) {
    totalRupees = Math.round(plan.billedRupees * 1.8 * 100) / 100;
  }
  const amountPaise = rupeesToPaise(totalRupees);

  const client = getRazorpayClient();
  if (!client) {
    logger.error('Razorpay keys not configured', { event: 'parent.subscription.order.no_client', context: { parentId: user.id } });
    return NextResponse.json({ error: 'Payment not available' }, { status: 503 });
  }

  try {
    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      notes: {
        parentId: user.id,
        childIds: JSON.stringify(childIds),
        isFamily: String(Boolean(isFamily)),
        emiMonths: emiMonths ? String(emiMonths) : '',
        planId,
        durationMonths: String(plan.durationMonths),
      },
    });

    if (!order?.id) throw new Error('Razorpay returned no order id');

    // Persist an order row referencing the parent user as the payer
    await prisma.paymentOrder.create({
      data: {
        studentId: user.id,
        razorpayOrderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
        planMonths: plan.durationMonths,
      },
    });

    return NextResponse.json({ orderId: order.id, amount: amountPaise, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID ?? '' }, { status: 200 });
  } catch (err) {
    logger.error('Failed to create parent Razorpay order', { event: 'parent.subscription.order.error', context: { parentId: user.id, planId, childIds }, err });
    return NextResponse.json({ error: 'Could not create order' }, { status: 500 });
  }
}

export default POST;
