import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createRazorpayOrder } from '@/lib/payments/razorpay'
import { recordPaymentEvent } from '@/lib/payments/audit'
import { randomUUID } from 'crypto'
import { PLANS } from '@/lib/billing/plans'
import type { PlanId } from '@/lib/billing/plans'

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => null)
    // Accept a planId from the client; validate it against known plans; default to standard_monthly.
    const rawPlanId = body?.planId
    const planId: PlanId = (rawPlanId && rawPlanId in PLANS) ? (rawPlanId as PlanId) : 'standard_monthly'

    const order = await createRazorpayOrder(userId, planId)
    if (!order) {
      const res = NextResponse.json({ error: 'Could not create payment order' }, { status: 500 })
      logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST' }, start)
      return res
    }

    // Ensure a provider idempotency key is created for this order. If the
    // client provided an idempotency header, prefer that; otherwise generate
    // a server-side UUID. This key will be used for downstream charges and
    // webhook reconciliation.
    const providedKey = (req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || '') as string
    const providerIdempotencyKey = providedKey || randomUUID()

    const plan = PLANS[planId]
    await prisma.paymentOrder.create({
      data: {
        studentId: userId,
        razorpayOrderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        status: 'created',
        planMonths: plan.durationMonths,
        planId,
        providerIdempotencyKey,
      },
    })

    // Audit: record order created event
    try {
      await recordPaymentEvent({
        userId: userId,
        provider: 'razorpay',
        providerIdempotencyKey,
        orderId: order.orderId,
        eventType: 'order.created',
        amount: order.amount,
        payload: { planId, durationMonths: plan.durationMonths },
      })
    } catch (err) {
      // Non-fatal: don't fail order creation if audit write fails
      logger.warn('recordPaymentEvent failed', { err })
    }

    const res = NextResponse.json(
      {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        planId,
        keyId: process.env.RAZORPAY_KEY_ID ?? '',
      },
      { status: 200 },
    )
    logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST', err }, start)
    return res
  }
}

