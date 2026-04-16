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
 * - 2026-04-16T03:30:00Z | copilot | support short plan ids (e.g. 'annual') and family variants to avoid undefined plan errors
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PLANS, rupeesToPaise, resolvePlanByShortId } from '@/lib/billing/plans';
import type { PlanId } from '@/lib/billing/plans';
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

  if (!planId) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  if (!childIds || childIds.length === 0 || childIds.length > 3) {
    return NextResponse.json({ error: 'Invalid childIds (must select 1-3 children)' }, { status: 400 });
  }

  // If family pricing requested, enforce exactly 3 children (MVP rule)
  if (isFamily && childIds.length !== 3) {
    return NextResponse.json({ error: 'Family pricing requires exactly 3 children' }, { status: 400 });
  }

  // Verify parent-child links
  const links = await prisma.parentStudent.findMany({ where: { parentId: user.id, studentId: { in: childIds }, status: 'active' }, select: { studentId: true } });
  if (links.length !== childIds.length) {
    return NextResponse.json({ error: 'One or more children are not linked to you' }, { status: 403 });
  }

  // Resolve to an actual plan object. Support short ids like 'annual' or
  // full keys like 'standard_annual'. When `isFamily` is requested prefer
  // the family plan variant if available.
  const plan = resolvePlanByShortId(planId, false);
  if (!plan) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  // Determine billed amount. If family pricing is requested and a family plan
  // exists use its billedRupees; otherwise apply the family multiplier.
  let totalRupees: number;
  if (isFamily) {
    const familyPlanKey = (`family_${planId}`) as PlanId;
    const familyPlan = (PLANS as any)[familyPlanKey] as typeof plan | undefined;
    if (familyPlan) {
      totalRupees = familyPlan.billedRupees;
    } else {
      totalRupees = Math.round(plan.billedRupees * 1.8 * 100) / 100;
    }
  } else {
    totalRupees = plan.billedRupees * childIds.length;
  }

  const amountPaise = rupeesToPaise(totalRupees);

  const client = getRazorpayClient();
  if (!client) {
    logger.error('Razorpay keys not configured', { event: 'parent.subscription.order.no_client', context: { parentId: user.id } });
    return NextResponse.json({ error: 'Payment not available' }, { status: 503 });
  }

  try {
    // Choose durationMonths from family plan when applicable, else from resolved plan.
    const familyPlanKey = (`family_${planId}`) as PlanId;
    const familyPlan = (PLANS as any)[familyPlanKey] as typeof plan | undefined;
    const durationMonths = familyPlan?.durationMonths ?? plan.durationMonths;

    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      notes: {
        parentId: user.id,
        childIds: JSON.stringify(childIds),
        isFamily: String(Boolean(isFamily)),
        emiMonths: emiMonths ? String(emiMonths) : '',
        planId,
        durationMonths: String(durationMonths),
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
        planMonths: durationMonths,
      },
    });

    return NextResponse.json({ orderId: order.id, amount: amountPaise, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID ?? '' }, { status: 200 });
  } catch (err) {
    logger.error('Failed to create parent Razorpay order', { event: 'parent.subscription.order.error', context: { parentId: user.id, planId, childIds }, err });
    return NextResponse.json({ error: 'Could not create order' }, { status: 500 });
  }
}

export default POST;
