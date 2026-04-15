/**
 * FILE OBJECTIVE:
 * - Create a Razorpay recurring subscription for an authenticated user.
 * - Replaces /api/billing/checkout as the canonical subscription creation endpoint.
 * - Validates planId, gates the internal test_weekly plan behind a DB whitelist,
 *   then delegates to the Razorpay Subscriptions API.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/payments/create-subscription.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | staff-engineer | created for Sprint A C1
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getRazorpay } from '@/lib/payments'
import { PLANS } from '@/lib/billing/plans'
import type { PlanId } from '@/lib/billing/plans'
import { RAZORPAY_SUB_PLAN_IDS, RAZORPAY_TOTAL_COUNT } from '@/lib/billing/razorpayPlanIds'

export async function POST(req: Request) {
  const start = Date.now()

  // 1. Auth -- must be logged in
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  const userEmail = (session?.user as { email?: string })?.email ?? ''
  const userName = (session?.user as { name?: string })?.name ?? ''
  if (!userId) {
    const res = NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, { status: 401 })
    logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 2. Parse and validate planId
  // Own-property check prevents prototype keys (toString, __proto__) from matching.
  const body = await req.json().catch(() => null)
  const planIdRaw: unknown = body?.planId
  const validPlanId =
    typeof planIdRaw === 'string' && Object.prototype.hasOwnProperty.call(PLANS, planIdRaw)
  if (!validPlanId) {
    const res = NextResponse.json({ code: 'INVALID_PLAN', message: 'Invalid plan' }, { status: 400 })
    logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
    return res
  }
  const planId = planIdRaw as PlanId
  const plan = PLANS[planId]

  // 3. Test plan gate: test_weekly requires whitelist entry
  if (planId === 'test_weekly') {
    const allowed = await prisma.testPlanAccess.findUnique({ where: { email: userEmail } })
    if (!allowed) {
      const res = NextResponse.json({ code: 'TEST_PLAN_ACCESS_DENIED', message: 'Not authorised for test plan' }, { status: 403 })
      logger.warn('create-subscription: test plan access denied', { userId, email: userEmail })
      logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
      return res
    }
  }

  // 4. Never allow internal plans to be created if the plan is internal and the caller is not
  //    using test_weekly (future-proofing: all internal plans go through the same gate above)
  if (plan.internal && planId !== 'test_weekly') {
    const res = NextResponse.json({ code: 'PLAN_UNAVAILABLE', message: 'Plan not available' }, { status: 403 })
    logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 5. Idempotency key from client header (or generate one)
  const providedKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || ''
  const idempotencyKey = providedKey || crypto.randomUUID()

  // 6. Get Razorpay client
  let razorpay: Awaited<ReturnType<typeof getRazorpay>>
  try {
    razorpay = await getRazorpay()
  } catch (err) {
    logger.error('create-subscription: Razorpay client unavailable', { error: String(err) })
    const res = NextResponse.json({ code: 'PAYMENT_UNAVAILABLE', message: 'Payment service temporarily unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  // 7. Create Razorpay subscription
  let rzpSub: { id: string }
  try {
    rzpSub = await razorpay.subscriptions.create({
      plan_id: RAZORPAY_SUB_PLAN_IDS[planId],
      customer_notify: 1,
      total_count: RAZORPAY_TOTAL_COUNT[planId],
      quantity: 1,
      notes: {
        userId,
        planId,
        email: userEmail,
        idempotencyKey,
      },
    })
  } catch (err) {
    logger.error('create-subscription: Razorpay subscriptions.create failed', {
      planId,
      razorpayPlanId: RAZORPAY_SUB_PLAN_IDS[planId],
      error: String(err),
    })
    const res = NextResponse.json({ code: 'SUBSCRIPTION_CREATE_FAILED', message: 'Could not create subscription' }, { status: 502 })
    logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
    return res
  }

  logger.info('create-subscription: subscription created', {
    userId,
    planId,
    subscriptionId: rzpSub.id,
  })

  const res = NextResponse.json(
    {
      subscriptionId: rzpSub.id,
      planId,
      planLabel: plan.label,
      email: userEmail,
      name: userName,
    },
    { status: 201 },
  )
  logger.logAPI(req, res, { className: 'CreateSubscriptionAPI', methodName: 'POST' }, start)
  return res
}
