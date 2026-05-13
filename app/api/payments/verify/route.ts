/**
 * FILE OBJECTIVE:
 * - Verify a client-side payment (Razorpay) using a signature and activate subscription on success.
 * - Records verification audit events and emits best-effort analytics for success/failure.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/payments/verify/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add file header and emit payment success/failure analytics in verify flow
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { activateSubscription, verifyPaymentSignature } from '@/lib/payments/razorpay'
import { PLANS } from '@/lib/billing/plans'
import { emitServerAnalyticsEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import type { PlanId } from '@/lib/billing/plans'

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => null)
    const orderId = String(body?.orderId ?? '')
    const paymentId = String(body?.paymentId ?? '')
    const signature = String(body?.signature ?? '')

    if (!orderId || !paymentId || !signature) {
      const res = NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
      logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST' }, start)
      return res
    }

    const valid = await verifyPaymentSignature({ orderId, paymentId, signature })
    if (!valid) {
      const res = NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      // Analytics: record payment failure due to invalid signature (best-effort)
      try {
        void emitServerAnalyticsEvent({
          eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_FAILURE,
          userId,
          metadata: { orderId, paymentId, reason: 'invalid_signature' },
        }, 'payments.verify')
      } catch {
        /* non-fatal */
      }
      logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST' }, start)
      return res
    }

    const order = await prisma.paymentOrder.findUnique({
      where: { razorpayOrderId: orderId },
    })
    if (!order || order.studentId !== userId) {
      const res = NextResponse.json({ error: 'Order not found for student' }, { status: 403 })
      logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST' }, start)
      return res
    }

    // Use the planId stored on the order when it is a valid own key on PLANS.
    // Fall back to standard_monthly for legacy orders without planId or for any invalid value.
    // Own-property check prevents prototype keys (toString, __proto__) from slipping through.
    const hasValidStoredPlanId =
      typeof order.planId === 'string' &&
      Object.prototype.hasOwnProperty.call(PLANS, order.planId)
    const planId: PlanId = hasValidStoredPlanId ? (order.planId as PlanId) : 'standard_monthly'
    const ok = await activateSubscription(userId, orderId, planId)
    if (!ok) {
      const res = NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 })
      // Analytics: record activation failure (best-effort)
      try {
        void emitServerAnalyticsEvent({
          eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_FAILURE,
          userId,
          metadata: { orderId, paymentId, planId, reason: 'activation_failed' },
        }, 'payments.verify')
      } catch {
        /* non-fatal */
      }
      logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST' }, start)
      return res
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpiry: true },
    })

    const res = NextResponse.json(
      {
        success: true,
        subscriptionExpiry: user?.subscriptionExpiry?.toISOString() ?? null,
      },
      { status: 200 },
    )
    // Analytics: successful payment verified and subscription activated
    try {
      void emitServerAnalyticsEvent({
        eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_SUCCESS,
        userId,
        metadata: { orderId, paymentId, planId, amount: order?.amount ?? null },
      }, 'payments.verify')
    } catch {
      /* non-fatal */
    }
    logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'PaymentsVerifyAPI', methodName: 'POST', err }, start)
    return res
  }
}

