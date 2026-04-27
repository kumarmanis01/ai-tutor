/**
 * FILE OBJECTIVE:
 * - Coupon creation, validation and redemption helpers for subscription discounts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/coupon.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | created initial coupon helper module
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger'
import { rupeesToPaise, resolvePlanByShortId } from '@/lib/billing/plans'

export type CreateCouponInput = {
  code: string
  description?: string
  type: 'PERCENT' | 'FIXED'
  amount: number
  currency?: string
  recurrence?: 'ONE_TIME' | 'RECURRING'
  scope?: 'GLOBAL' | 'STUDENT' | 'BATCH'
  studentId?: string
  batchId?: string
  maxUses?: number
  maxUsesPerUser?: number
  validFrom?: Date
  validUntil?: Date
  createdBy?: string
  metadata?: any
}

export type ValidateResult = { status: number; body: { ok?: boolean; error?: string; coupon?: any } }
export type RedeemResult = { status: number; body: { ok?: boolean; error?: string; amountAppliedPaise?: number; percentApplied?: number } }

/**
 * Create a coupon record.
 */
export async function createCoupon(prisma: PrismaClient, input: CreateCouponInput) {
  const data: any = {
    code: input.code,
    description: input.description ?? null,
    type: input.type,
    amount: input.amount,
    currency: input.currency ?? 'INR',
    recurrence: input.recurrence ?? 'ONE_TIME',
    scope: input.scope ?? 'GLOBAL',
    studentId: input.studentId ?? null,
    batchId: input.batchId ?? null,
    maxUses: input.maxUses ?? null,
    maxUsesPerUser: input.maxUsesPerUser ?? null,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    createdBy: input.createdBy ?? null,
    metadata: input.metadata ?? null,
  }
  return prisma.coupon.create({ data })
}

/**
 * Retrieve coupon by code (transaction-safe when provided with a TransactionClient).
 */
export async function getCouponByCode(tx: Prisma.TransactionClient, code: string) {
  return tx.coupon.findUnique({ where: { code } })
}

/**
 * Validate a coupon code for a user. Does not mutate state.
 */
export async function validateCoupon(tx: Prisma.TransactionClient, code: string, userId?: string): Promise<ValidateResult> {
  const c = await tx.coupon.findUnique({ where: { code } })
  if (!c) return { status: 404, body: { error: 'invalid_code' } }
  if (!c.active) return { status: 400, body: { error: 'inactive_code' } }
  const now = new Date()
  if (c.validFrom && now < c.validFrom) return { status: 400, body: { error: 'not_yet_valid' } }
  if (c.validUntil && now > c.validUntil) return { status: 400, body: { error: 'expired' } }
  if (c.maxUses != null && c.uses >= c.maxUses) return { status: 400, body: { error: 'usage_limit_reached' } }

  if (c.scope === 'STUDENT') {
    if (!userId) return { status: 400, body: { error: 'user_required' } }
    if (c.studentId !== userId) return { status: 403, body: { error: 'not_permitted' } }
  }

  if (c.maxUsesPerUser != null && userId) {
    const used = await tx.couponRedemption.count({ where: { couponId: c.id, userId } })
    if (used >= c.maxUsesPerUser) return { status: 400, body: { error: 'user_limit_reached' } }
  }

  return { status: 200, body: { ok: true, coupon: c } }
}

/**
 * Redeem a coupon inside a transaction. Returns details about applied discount.
 * - For FIXED coupons: applies `amount` (paise) to subscription.creditBalance if subscriptionId or active subscription exists.
 * - For PERCENT coupons: records percentApplied and returns percentApplied for caller to compute the paise value.
 */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  code: string,
  userId?: string,
  subscriptionId?: string,
  options?: { applyAsCredit?: boolean },
): Promise<RedeemResult> {
  // Validate first
  const v = await validateCoupon(tx, code, userId)
  if (v.status !== 200 || !v.body.coupon) return v as RedeemResult

  const coupon = v.body.coupon as any

  // Locking pattern: optimistic update via update where uses is incremented
  try {
    // Optionally determine target subscription
    let targetSubscriptionId = subscriptionId
    if (!targetSubscriptionId && userId) {
      const sub = await tx.subscription.findFirst({ where: { userId, active: true }, select: { id: true } })
      if (sub) targetSubscriptionId = sub.id
    }

    const applyAsCredit = options?.applyAsCredit ?? true

    // Record redemption and update coupon usage
    await tx.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } })

    let amountAppliedPaise: number | undefined
    let percentApplied: number | undefined

    if (coupon.type === 'FIXED') {
      amountAppliedPaise = coupon.amount
      if (targetSubscriptionId && applyAsCredit) {
        try {
          await tx.subscription.update({ where: { id: targetSubscriptionId }, data: { creditBalance: { increment: amountAppliedPaise } } })
        } catch (err) {
          logger.warn('redeemCoupon: failed applying credit to subscription', { err: String(err), couponId: coupon.id, subscriptionId: targetSubscriptionId })
        }
      }
    } else {
      // Percent coupon: store percentApplied; caller decides how to apply to an upcoming order
      percentApplied = coupon.amount
      // If caller provided a subscriptionId and we can resolve a plan price, compute paise amount (best-effort)
      if (targetSubscriptionId && applyAsCredit) {
        try {
          const sub = await tx.subscription.findUnique({ where: { id: targetSubscriptionId }, select: { billingCycle: true } })
          if (sub && sub.billingCycle) {
            // billingCycle is e.g. 'monthly' or 'annual' -- try to resolve a plan via short id
            const plan = resolvePlanByShortId(String(sub.billingCycle))
            if (plan) {
              const planPaise = rupeesToPaise(plan.billedRupees)
              amountAppliedPaise = Math.max(1, Math.floor((planPaise * (percentApplied as number)) / 100))
              // Apply as credit
              await tx.subscription.update({ where: { id: targetSubscriptionId }, data: { creditBalance: { increment: amountAppliedPaise } } })
            }
          }
        } catch (err) {
          logger.warn('redeemCoupon: percent apply best-effort failed', { err: String(err), couponId: coupon.id, subscriptionId: targetSubscriptionId })
        }
      }
    }

    await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: userId ?? null, subscriptionId: targetSubscriptionId ?? null, amountApplied: amountAppliedPaise ?? null, percentApplied: percentApplied ?? null, metadata: null } })

    return { status: 200, body: { ok: true, amountAppliedPaise: amountAppliedPaise ?? undefined, percentApplied: percentApplied ?? undefined } }
  } catch (err: any) {
    logger.error('redeemCoupon: failed', { err: String(err), code, userId })
    return { status: 500, body: { error: 'redeem_failed' } }
  }
}

const Coupon = { createCoupon, getCouponByCode, validateCoupon, redeemCoupon }
export default Coupon
