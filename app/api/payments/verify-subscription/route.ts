/**
 * FILE OBJECTIVE:
 * - Verify a Razorpay subscription payment after the client-side checkout completes.
 * - Verifies HMAC signature, is idempotent, creates Payment + Subscription DB records,
 *   emits analytics, and sends confirmation email.
 * - Replaces /api/billing/verify as the canonical subscription verify endpoint.
 *
 * Signature scheme (Razorpay subscriptions):
 *   HMAC-SHA256( razorpay_subscription_id + "|" + razorpay_payment_id, KEY_SECRET )
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/payments/verify-subscription.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | staff-engineer | created for Sprint A C1
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { PLANS, rupeesToPaise, planEndDate } from '@/lib/billing/plans'
import type { PlanId } from '@/lib/billing/plans'
import { recordPaymentEvent } from '@/lib/payments/audit'
import { sendMail } from '@/lib/mailer'
import { paymentReceiptHtml } from '@/lib/email/templates'

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex')
    const bBuf = Buffer.from(b, 'hex')
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const start = Date.now()

  // 1. Auth
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  const userEmail = (session?.user as { email?: string })?.email ?? ''
  const userName = (session?.user as { name?: string })?.name ?? ''
  if (!userId) {
    const res = NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, { status: 401 })
    logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 2. Parse body
  const body = await req.json().catch(() => null)
  const subscriptionId: string = body?.razorpay_subscription_id ?? ''
  const paymentId: string = body?.razorpay_payment_id ?? ''
  const signature: string = body?.razorpay_signature ?? ''
  const planIdRaw: string = body?.planId ?? ''

  if (!subscriptionId || !paymentId || !signature) {
    const res = NextResponse.json({ code: 'MISSING_FIELDS', message: 'razorpay_subscription_id, razorpay_payment_id and razorpay_signature are required' }, { status: 400 })
    logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 3. Validate planId (client-supplied; fall back to standard_monthly for safety)
  const planId: PlanId = (planIdRaw && planIdRaw in PLANS) ? (planIdRaw as PlanId) : 'standard_monthly'
  const plan = PLANS[planId]

  // 4. Verify Razorpay HMAC signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? ''
  if (!keySecret) {
    logger.error('verify-subscription: RAZORPAY_KEY_SECRET not set', {})
    const res = NextResponse.json({ code: 'CONFIGURATION_ERROR', message: 'Payment configuration error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${subscriptionId}|${paymentId}`)
    .digest('hex')

  if (!timingSafeEqual(expected, signature)) {
    logger.warn('verify-subscription: invalid signature', { userId, paymentId })
    const res = NextResponse.json({ code: 'INVALID_SIGNATURE', message: 'Payment verification failed' }, { status: 400 })
    logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 5. Idempotency: if this payment was already recorded, return success immediately
  const existingPayment = await prisma.payment.findFirst({
    where: { transactionId: paymentId },
    select: { id: true },
  })
  if (existingPayment) {
    logger.info('verify-subscription: idempotent hit', { paymentId })
    const res = NextResponse.json({ success: true, idempotent: true })
    logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 6. Capture idempotency header
  const idempotencyHeader = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || ''

  // 7. Compute subscription dates
  const startDate = new Date()
  const endDate = planEndDate(plan, startDate)
  const amountPaise = rupeesToPaise(plan.billedRupees)
  const billingCycle = planId.includes('annual') ? 'annual' : planId.includes('weekly') ? 'weekly' : 'monthly'

  // 8. Prisma transaction: payment + subscription records
  try {
    await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          userId,
          amount: amountPaise,
          provider: 'razorpay',
          providerIdempotencyKey: idempotencyHeader || undefined,
          status: 'success',
          transactionId: paymentId,
          orderId: subscriptionId, // subscription ID serves as the order reference
          plan: planId,
          billingCycle,
          meta: { razorpay_subscription_id: subscriptionId, razorpay_signature: signature },
        },
      })

      // Deactivate any existing active subscriptions for this user
      await tx.subscription.updateMany({
        where: { userId, active: true },
        data: { active: false },
      })

      // Create new active subscription
      await tx.subscription.create({
        data: {
          userId,
          plan: planId,
          billingCycle,
          startDate,
          endDate,
          active: true,
          childSlots: plan.childSlots ?? 1,
          paymentId: payment.id,
          razorpaySubscriptionId: subscriptionId,
        },
      })
    })
  } catch (err) {
    logger.error('verify-subscription: DB transaction failed', {
      userId,
      paymentId,
      planId,
      error: String(err),
    })
    const res = NextResponse.json({ code: 'DB_ERROR', message: 'Could not activate subscription' }, { status: 500 })
    logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 9. Audit event (best-effort, non-fatal)
  try {
    await recordPaymentEvent({
      userId,
      provider: 'razorpay',
      providerIdempotencyKey: idempotencyHeader || undefined,
      transactionId: paymentId,
      orderId: subscriptionId,
      eventType: 'subscription.verified',
      amount: amountPaise,
      status: 'success',
      payload: { planId, billingCycle },
    })
  } catch (auditErr) {
    logger.warn('verify-subscription: audit write failed (non-fatal)', { error: String(auditErr) })
  }

  // 10. Analytics event (best-effort, non-fatal)
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType: 'converted_to_paid',
        userId,
        metadata: { planId, billingCycle, amountPaise },
      },
    })
  } catch (analyticsErr) {
    logger.warn('verify-subscription: analytics write failed (non-fatal)', { error: String(analyticsErr) })
  }

  // 11. Confirmation email (best-effort, non-fatal)
  if (userEmail) {
    try {
      await sendMail({
        to: userEmail,
        subject: 'Subscription confirmed -- Spinzy Academy',
        html: paymentReceiptHtml({
          studentName: userName,
          plan: plan.label,
          amountRupees: plan.billedRupees,
          billingCycle,
          renewalDate: endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        }),
      })
    } catch (mailErr) {
      logger.error('verify-subscription: confirmation email failed (non-fatal)', { error: String(mailErr) })
    }
  }

  logger.info('verify-subscription: subscription activated', { userId, planId, subscriptionId })

  const res = NextResponse.json({ success: true }, { status: 200 })
  logger.logAPI(req, res, { className: 'VerifySubscriptionAPI', methodName: 'POST' }, start)
  return res
}
