/**
 * FILE OBJECTIVE:
 * - Centralized referral redemption logic used by API handlers and webhooks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/referral/fraudDetection.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | add referral service helper redeemReferral
 * - 2026-04-17T14:40:00Z | copilot | fix: include required `icon` field when creating badge to satisfy Prisma types
 */

import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { PLANS, rupeesToPaise, resolvePlanByShortId } from '@/lib/billing/plans'

export type RedeemResult = { status: number; body: { error?: string; ok?: boolean; alreadyRedeemed?: boolean; voided?: boolean; badge?: unknown } }

/**
 * Redeem a referral code inside an existing Prisma transaction.
 * - `tx` must be a Prisma TransactionClient so callers can include this as part of larger operations.
 */
export async function redeemReferral(tx: Prisma.TransactionClient, code: string, redeemerId: string, redeemerIp?: string): Promise<RedeemResult> {
  const referral = await tx.referral.findUnique({ where: { code } })
  if (!referral) return { status: 404, body: { error: 'Invalid code' } }

  if (referral.redeemedBy) return { status: 200, body: { ok: true, alreadyRedeemed: true } }

  if (referral.createdBy === redeemerId) {
    return { status: 400, body: { error: 'Referral code cannot be used by its creator.', voided: true } }
  }

  const metadata = (referral.metadata as Record<string, unknown>) ?? null
  const creatorIp = typeof metadata?.creatorIp === 'string' ? (metadata.creatorIp as string) : null
  if (creatorIp && redeemerIp && creatorIp === redeemerIp) {
    return { status: 400, body: { error: 'Referral reward voided: same device or network detected.', voided: true } }
  }

  const newMetadata = referral.metadata && typeof referral.metadata === 'object' ? { ...(referral.metadata as Record<string, any>), rewardApplied: true } : { rewardApplied: true }

  await tx.referral.update({ where: { id: referral.id }, data: { redeemedBy: redeemerId, redeemedAt: new Date(), metadata: newMetadata } })

  try {
    const REDEEM_POINTS = 50
    await tx.user.update({ where: { id: redeemerId }, data: { points: { increment: REDEEM_POINTS } } })
    if (referral.createdBy) {
      await tx.user.update({ where: { id: referral.createdBy }, data: { points: { increment: REDEEM_POINTS } } })
    }

    // Create payload for badge upsert (rely on inference to avoid stale Prisma type names)
    const createBadge = {
      key: 'referral_invite',
      name: 'Referral Inviter',
      description: 'Awarded for inviting friends to join.',
      icon: 'referral_invite',
    }

    const badge = await tx.badge.upsert({
      where: { key: 'referral_invite' },
      update: {},
      create: createBadge,
    })

    // Create a ReferralReward for the referrer (one month free). If the referrer
    // has an active subscription, apply immediately by incrementing subscription.creditBalance;
    // otherwise leave as PENDING so it can be applied when they next subscribe.
    try {
      if (referral.createdBy) {
        const referrerId = referral.createdBy

        // Find active subscription for referrer
        const sub = await tx.subscription.findFirst({ where: { userId: referrerId, active: true }, select: { id: true, billingCycle: true } })

        // Determine amount (one month of their plan; fallback to standard monthly)
        const planKey = sub?.billingCycle ?? undefined
        let plan = planKey ? resolvePlanByShortId(String(planKey)) : undefined
        if (!plan) plan = PLANS.standard_monthly
        const rewardAmount = rupeesToPaise(plan.billedRupees)

        const rr = await tx.referralReward.create({ data: { referralId: referral.id, userId: referrerId, amount: rewardAmount, status: 'PENDING' } })

        if (sub) {
          // Apply immediately
          await tx.subscription.update({ where: { id: sub.id }, data: { creditBalance: { increment: rewardAmount } } })
          await tx.referralReward.update({ where: { id: rr.id }, data: { status: 'APPLIED', appliedAt: new Date() } })
        }
      }
    } catch (err) {
      logger.warn('redeemReferral: failed creating/applying referral reward', { err: String(err) })
    }

    return { status: 200, body: { ok: true, badge } }
  } catch (err: unknown) {
    logger.error('redeemReferral: failed applying rewards', { err: String(err) })
    return { status: 500, body: { error: 'redeem_failed', detail: String(err) } as any }
  }
}
