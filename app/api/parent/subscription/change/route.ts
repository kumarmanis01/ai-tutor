/**
 * POST /api/parent/subscription/change
 *
 * Create an upgrade or schedule a downgrade for a parent subscription.
 * - Upgrades: prorated credit applied, immediate effect on successful payment (or immediate if net <= 0).
 * - Downgrades: scheduled to take effect at current subscription end (no mid-cycle refund).
 *
 * FILE OBJECTIVE:
 * - API route to orchestrate parent subscription change orders.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription-change.spec.ts (not yet created)
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created subscription change endpoint
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Razorpay from 'razorpay';
import { PLANS, rupeesToPaise } from '@/lib/billing/plans';
import { calculateProrationCredit } from '@/lib/subscription/proration';
import type { PlanId } from '@/lib/billing/plans';
import { sendMailSafe } from '@/lib/mailer';

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const VALID_PLAN_IDS: PlanId[] = Object.keys(PLANS) as PlanId[];

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const user = (session?.user as { id?: string; role?: string }) ?? null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const planId = typeof b.planId === 'string' ? b.planId as PlanId : undefined;
  const action = typeof b.action === 'string' ? b.action as 'upgrade' | 'downgrade' : undefined;
  const childIds = Array.isArray(b.childIds) ? (b.childIds as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const isFamily = Boolean(b.isFamily);
  const emiMonths = typeof b.emiMonths === 'number' ? b.emiMonths : undefined;

  if (!planId || !VALID_PLAN_IDS.includes(planId)) return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  if (!action || !['upgrade','downgrade'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  if (!childIds || childIds.length === 0 || childIds.length > 3) return NextResponse.json({ error: 'Invalid childIds' }, { status: 400 });

  // Verify parent-child links
  const links = await prisma.parentStudent.findMany({ where: { parentId: user.id, studentId: { in: childIds }, status: 'active' }, select: { studentId: true } });
  if (links.length !== childIds.length) return NextResponse.json({ error: 'One or more children are not linked to you' }, { status: 403 });

  // F-PAR-023 AC-06: sensitive subscription changes require OTP-verified parent phone.
  const parentSecurity = await prisma.user.findUnique({
    where: { id: user.id },
    select: { parentPhoneVerifiedAt: true },
  })
  if (!parentSecurity?.parentPhoneVerifiedAt) {
    return NextResponse.json({ error: 'Parent phone OTP verification required before subscription changes' }, { status: 403 })
  }

  const plan = PLANS[planId];

  try {
    const now = new Date();

    // Pricing rules: prefer explicit family plan variant when requested, but only
    // when the requested plan belongs to the `standard` product. Otherwise fall
    // back to applying the 1.8x multiplier to the requested plan's price.
    const suffix = typeof planId === 'string' && planId.includes('_') ? planId.split('_').slice(-1)[0] : planId;
    const familyKey = (`family_${suffix}`) as PlanId;
    const familyPlan = (PLANS as any)[familyKey] as typeof plan | undefined;
    const useExplicitFamily = Boolean(isFamily && familyPlan && typeof planId === 'string' && planId.startsWith('standard_'));
    let totalRupees: number;
    if (isFamily) {
      if (useExplicitFamily) {
        totalRupees = familyPlan!.billedRupees;
      } else {
        totalRupees = Math.round(plan.billedRupees * 1.8 * 100) / 100;
      }
    } else {
      totalRupees = plan.billedRupees * childIds.length;
    }

    // Fetch current active parent subscription (if any)
    const current = await prisma.subscription.findFirst({ where: { userId: user.id, active: true } });

    if (action === 'downgrade') {
      if (!current) return NextResponse.json({ error: 'No active subscription to downgrade' }, { status: 400 });
      // Schedule a downgrade by creating a scheduled record in payments (system-scheduled)
      await prisma.payment.create({
        data: {
          userId: user.id,
          amount: 0,
          provider: 'system',
          status: 'scheduled',
          meta: { scheduledChange: true, newPlanId: planId, effectiveDate: current.endDate?.toISOString() },
        },
      });

      // F-PAR-023 AC-04: immediate confirmation with access expiry + resubscribe link.
      try {
        const parent = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } })
        if (parent?.email) {
          const expiryLabel = current.endDate ? current.endDate.toLocaleDateString('en-IN') : 'the end of your current billing period'
          const resubscribeLink = `${(process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com').replace(/\/$/, '')}/parent/billing`
          const subject = 'Subscription change confirmed -- access continues till period end'
          const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>Your subscription downgrade/cancellation request is confirmed.</p><p>Access will continue until <strong>${expiryLabel}</strong>.</p><p>You can resubscribe anytime here: <a href="${resubscribeLink}">Resubscribe</a>.</p>`
          await sendMailSafe({ to: parent.email, subject, html })
        }
      } catch (notifyErr) {
        logger.warn('parent.subscription.change: cancellation confirmation email failed', { err: String(notifyErr), parentId: user.id })
      }

      return NextResponse.json({ ok: true, scheduledEffectiveDate: current.endDate?.toISOString() }, { status: 200 });
    }

    // action === 'upgrade'
    let credit = 0;
    if (current && current.startDate && current.endDate) {
      // Determine billedRupees for existing billingCycle
      const curCycle = (current.billingCycle || '') as PlanId;
      const curPlan = PLANS[curCycle as PlanId];
      if (curPlan) {
        const pr = calculateProrationCredit({ startDate: current.startDate!, endDate: current.endDate!, now, billedRupees: curPlan.billedRupees });
        credit = pr.creditRupees;
      }
    }

    const netCharge = Math.round(Math.max(0, totalRupees - credit) * 100) / 100;

    if (netCharge <= 0) {
      // No payment required; apply immediately
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + plan.durationMonths);

      await prisma.$transaction(async (tx) => {
        // Create successful Payment record (zero-amount)
        const payment = await tx.payment.create({ data: { userId: user.id, amount: 0, provider: 'system', status: 'success', plan: plan.label, billingCycle: plan.perMonthDisplay, meta: { changeType: 'upgrade', previousExpiry: current?.endDate?.toISOString() } } });

        // Update or create parent subscription
        if (current) {
          await tx.subscription.update({ where: { id: current.id }, data: { billingCycle: planId, startDate: now, endDate: expiry, active: true, paymentId: payment.id } });
        } else {
          await tx.subscription.create({ data: { userId: user.id, plan: childIds.length > 1 ? 'family' : 'individual', billingCycle: planId, startDate: now, endDate: expiry, active: true, childSlots: childIds.length, paymentId: payment.id } });
        }

        // Apply to children
        for (const sid of childIds) {
          await tx.user.update({ where: { id: sid }, data: { subscriptionStatus: 'active', subscriptionExpiry: expiry } });
        }
      });

      return NextResponse.json({ success: true, subscriptionExpiry: expiry.toISOString() }, { status: 200 });
    }

    // Otherwise create a Razorpay order for netCharge
    const client = getRazorpayClient();
    if (!client) return NextResponse.json({ error: 'Payment not available' }, { status: 503 });

    const amountPaise = rupeesToPaise(netCharge);
    const order = await client.orders.create({ amount: amountPaise, currency: 'INR', notes: { parentId: user.id, childIds: JSON.stringify(childIds), isFamily: String(Boolean(isFamily)), planId, changeType: 'upgrade', previousExpiry: current?.endDate?.toISOString() || '', emiMonths: emiMonths ? String(emiMonths) : '' } });

    await prisma.paymentOrder.create({ data: { studentId: user.id, razorpayOrderId: order.id, amount: amountPaise, currency: 'INR', status: 'created', planMonths: plan.durationMonths, planId } });

    return NextResponse.json({ orderId: order.id, amount: amountPaise, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID ?? '' }, { status: 200 });
  } catch (err) {
    logger.error('parent.subscription.change failed', { err, parentId: user.id });
    return NextResponse.json({ error: 'Could not create change order' }, { status: 500 });
  }
}

export default POST;
