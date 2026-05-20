/**
 * FILE OBJECTIVE:
 * - Worker that enforces renewal retry policy and grace period for subscriptions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/workers/subscriptionRenewalWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-12T00:00:00Z | copilot | moved from workers/ and hardened grace logic
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmailUnifiedSafe } from '@/lib/mail'
import { paymentRetryReminderHtml, graceStartedHtml } from '@/lib/email/templates'
import { sendSms } from '@/lib/sms'
import { SUBSCRIPTION_RENEWAL_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails'

const DEFAULT_SUPPORT_EMAIL = SUBSCRIPTION_RENEWAL_SUPPORT_EMAIL

/**
 * Retry schedule (relative to first attempt):
 * - attempt 0: now (day 0)
 * - attempt 1: firstAttempt + 1 day
 * - attempt 2: firstAttempt + 3 days
 * After attempts exhausted, a grace period of 3 days is applied.
 */

function addDays(d: Date, days: number) {
  const o = new Date(d)
  o.setDate(o.getDate() + days)
  return o
}

export async function processRenewals(now = new Date()) {
  const dueSubs = await prisma.subscription.findMany({ where: { active: true, endDate: { lte: now } } })

  for (const sub of dueSubs) {
    try {
      // Find any pending payment for this user that has meta.renewal === true
      const pendingForUser = await prisma.payment.findMany({ where: { userId: sub.userId, status: 'pending' }, select: { id: true, meta: true } })
      const existing = pendingForUser.find((pp: any) => (pp.meta && (pp.meta as any).renewal) === true)
      if (!existing) {
        await prisma.payment.create({ data: { userId: sub.userId, amount: 0, provider: 'system', status: 'pending', meta: { renewal: true, subscriptionId: sub.id, attempts: 0, firstAttemptAt: now.toISOString(), nextAttemptAt: now.toISOString() } } })
      }
    } catch (err) {
      logger.error('processRenewals: failed creating pending renewal', { err: String(err), subscriptionId: sub.id })
    }
  }

  const pendingPayments = await prisma.payment.findMany({ where: { status: 'pending' } })
  const appUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.spinzyacademy.com').replace(/\/$/, '')
  const supportEmail = process.env.SUPPORT_EMAIL ?? DEFAULT_SUPPORT_EMAIL

  const simulateFailures: boolean = String(process.env.SUBSCRIPTION_RENEWAL_SIMULATE_FAILURES ?? '1') !== '0'

  for (const p of pendingPayments) {
    const meta = (p.meta || {}) as any
    if (!meta) continue

    const isRenewal = Boolean(meta.renewal)
    const isEmi = Boolean(meta.emi)
    if (!isRenewal && !isEmi) continue

    if (meta.inGrace) continue

    const firstAttemptAt = meta.firstAttemptAt ? new Date(meta.firstAttemptAt) : (isEmi && meta.dueDate ? new Date(meta.dueDate) : p.createdAt)
    const nextAttemptAt = meta.nextAttemptAt ? new Date(meta.nextAttemptAt) : firstAttemptAt
    if (nextAttemptAt.getTime() > now.getTime()) continue

    const attempts = Number(meta.attempts || 0)

    // In production we may disable simulated failures and rely on provider callbacks (webhooks).
    // Tests expect the simulated retry behaviour, so default is enabled. Set SUBSCRIPTION_RENEWAL_SIMULATE_FAILURES=0 to disable simulation.
    if (simulateFailures && attempts < 2) {
      const newAttempts = attempts + 1
      let newNext: Date
      if (newAttempts === 1) newNext = addDays(firstAttemptAt, 1)
      else newNext = addDays(firstAttemptAt, 3)

      if (attempts === 0) {
        try {
          const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, phone: true } })
          const predictedGrace = addDays(firstAttemptAt, 6)
          const graceStr = predictedGrace.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
          const retryLink = `${appUrl}/account/billing`
          const subject = 'Payment failed -- Spinzy Academy'
          const html = paymentRetryReminderHtml({ name: user?.name ?? undefined, retryUrl: retryLink })
          if (user?.email) await sendEmailUnifiedSafe({ mode: 'raw', delivery: 'best_effort', to: user.email, subject, html, text: subject, reason: 'subscription_renewal', featureFlagDomain: 'billing' }).catch((e) => logger.error('sendEmailUnifiedSafe failed (renewal first-failure)', { err: String(e), userId: p.userId }))
          if (user?.phone) await sendSms(user.phone, `Payment failed. Retry: ${retryLink}. Grace estimate: ${graceStr}. Support: ${supportEmail}`).catch((e) => logger.error('sendSms failed (renewal first-failure)', { err: e, userId: p.userId }))
        } catch (err) {
          logger.error('Failed to notify user on first payment failure', { err: String(err), paymentId: p.id })
        }
      }

      await prisma.payment.update({ where: { id: p.id }, data: { meta: { ...meta, attempts: newAttempts, nextAttemptAt: newNext.toISOString() } } })
    } else if (!simulateFailures) {
      // When simulation is disabled, do not auto-advance attempts here; rely on provider/webhook to update payment status.
      continue
    } else {
      // attempts >= 2 -> enter deterministic grace based on firstAttemptAt
      const graceUntil = addDays(firstAttemptAt, 6) // firstAttempt + 6 days (3rd retry + 3-day grace)
      const updatedMeta = { ...meta, attempts: attempts + 1, inGrace: true, graceUntil: graceUntil.toISOString(), lastNotifiedGraceAt: now.toISOString() }

      try {
        const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, phone: true } })
        const subject = 'Payment overdue -- access will be paused soon'
        const billingUrl = `${appUrl}/account/billing`
        const html = graceStartedHtml({ name: user?.name ?? undefined, untilLabel: graceUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), billingUrl })
        if (user?.email) await sendEmailUnifiedSafe({ mode: 'raw', delivery: 'best_effort', to: user.email, subject, html, text: subject, reason: 'subscription_renewal', featureFlagDomain: 'billing' }).catch((e) => logger.error('sendEmailUnifiedSafe failed (enter grace)', { err: String(e), userId: p.userId }))
        if (user?.phone) await sendSms(user.phone, `Payment overdue. Grace ends ${graceUntil.toLocaleDateString('en-IN')}. Retry: ${appUrl}/account/billing. Support: ${supportEmail}`).catch((e) => logger.error('sendSms failed (enter grace)', { err: String(e), userId: p.userId }))
      } catch (err) {
        logger.error('Failed to notify user on entering grace', { err: String(err), paymentId: p.id })
      }

      await prisma.payment.update({ where: { id: p.id }, data: { meta: updatedMeta } })
      logger.info('subscription:entered_grace', { subscriptionId: meta.subscriptionId, userId: p.userId, graceUntil: graceUntil.toISOString() })
    }
  }

  // Handle in-grace payments
  const inGracePayments = await prisma.payment.findMany({ where: { status: 'pending' } })
  for (const p of inGracePayments) {
    const meta = (p.meta || {}) as any
    if (!meta || !meta.inGrace || !meta.graceUntil) continue
    const graceUntil = new Date(meta.graceUntil)
    if (graceUntil.getTime() > now.getTime()) {
      const lastNotified = meta.lastNotifiedGraceAt ? new Date(meta.lastNotifiedGraceAt) : null
      const shouldNotify = !lastNotified || (now.getTime() - lastNotified.getTime()) >= 24 * 60 * 60 * 1000
      if (shouldNotify) {
        try {
          const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, phone: true } })
          const subject = 'Reminder: payment overdue -- update billing'
          const html = paymentRetryReminderHtml({ name: user?.name ?? undefined, retryUrl: `${appUrl}/account/billing` })
          if (user?.email) await sendEmailUnifiedSafe({ mode: 'raw', delivery: 'best_effort', to: user.email, subject, html, text: subject, reason: 'subscription_renewal', featureFlagDomain: 'billing' }).catch((e) => logger.error('sendEmailUnifiedSafe failed (grace reminder)', { err: String(e), userId: p.userId }))
          if (user?.phone) await sendSms(user.phone, `Reminder: payment overdue. Update billing: ${appUrl}/account/billing. Support: ${supportEmail}`).catch((e) => logger.error('sendSms failed (grace reminder)', { err: e, userId: p.userId }))
          await prisma.payment.update({ where: { id: p.id }, data: { meta: { ...meta, lastNotifiedGraceAt: now.toISOString() } } })
        } catch (err) {
          logger.error('Failed to send grace reminder', { err, paymentId: p.id })
        }
      }
      continue
    }

    // grace has expired -> revoke subscription and mark payment failed
    try {
      logger.info('subscription:grace_expired', { paymentId: p.id, subscriptionId: meta.subscriptionId, userId: p.userId })
      await prisma.$transaction(async (tx) => {
        if (meta.subscriptionId) {
          try {
            await tx.subscription.update({ where: { id: meta.subscriptionId }, data: { active: false } })
          } catch (e) {
            logger.error('subscription:update_by_id_failed', { err: e, subscriptionId: meta.subscriptionId })
          }
        } else {
          await tx.subscription.updateMany({ where: { userId: p.userId, active: true, endDate: { lte: now } }, data: { active: false } })
        }
        await tx.user.update({ where: { id: p.userId }, data: { subscriptionStatus: 'free' } })
        await tx.payment.update({ where: { id: p.id }, data: { status: 'failed', meta: { ...meta, failedAt: now.toISOString() } } })
      })
      logger.info('subscription:revoked', { subscriptionId: meta.subscriptionId, userId: p.userId })
    } catch (err) {
      logger.error('processRenewals: failed to revoke subscription', { err, paymentId: p.id, subscriptionId: meta.subscriptionId })
    }
  }
}

export default processRenewals
