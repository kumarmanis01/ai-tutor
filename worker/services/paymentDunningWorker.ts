/**
 * Payment dunning processor.
 * - Sends retry reminders on schedule (day 1, day 3) for subscriptions with failed payments
 * - Starts a 3-day grace period after 3 failed attempts and notifies parent
 * - Deactivates subscription and reverts child accounts after grace period expires
 */

import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { sendMailSafe } from '../../lib/mailer.js'
import { sendSms } from '../../lib/sms.js'
import { getRedis } from '../../lib/redis.js'

function toIso(d: Date) { return d.toISOString() }

export async function processPaymentDunning(): Promise<void> {
  const now = new Date()
  const redis = getRedis()

  try {
    // 1) Handle scheduled retry attempts:
    // For subscriptions with dunningAttempts 1 or 2, check if next retry window passed.
    const subs = await prisma.subscription.findMany({ where: { active: true, dunningAttempts: { gt: 0, lt: 3 } } })

    for (const s of subs) {
      try {
        if (!s.lastDunningAt) continue
        const attempts = s.dunningAttempts ?? 0
        const elapsedMs = now.getTime() - new Date(s.lastDunningAt).getTime()
        const shouldRunNext = (attempts === 1 && elapsedMs >= 24 * 60 * 60 * 1000) || (attempts === 2 && elapsedMs >= 2 * 24 * 60 * 60 * 1000)
        if (!shouldRunNext) continue

        // We can't auto-charge without a stored payment method; so we send a retry reminder
        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, phone: true, name: true } })
        if (!parent) continue

        const subject = `Payment retry reminder — Spinzy subscription`
        const retryLink = `${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We attempted to renew your Spinzy subscription again but couldn't complete the payment. Please retry here: <a href="${retryLink}">Update payment & retry</a></p><p>If you need help, contact support at ${process.env.SUPPORT_EMAIL ?? 'support@spinzyacademy.com'}.</p>`

        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Subscription retry: please update payment at ${retryLink}`)

        // bump attempt count and set lastDunningAt
        await prisma.subscription.update({ where: { id: s.id }, data: { dunningAttempts: { increment: 1 }, lastDunningAt: now } })
      } catch (err) {
        logger.error('paymentDunning: error processing retry attempt', { subscriptionId: s.id, error: String(err) })
      }
    }

    // 2) Start grace when attempts hit 3 (if not already started) and notify parent
    const subsToGrace = await prisma.subscription.findMany({ where: { active: true, dunningAttempts: { gte: 3 }, graceUntil: null } })
    for (const s of subsToGrace) {
      try {
        const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        await prisma.subscription.update({ where: { id: s.id }, data: { graceUntil } })

        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, phone: true, name: true } })
        if (!parent) continue
        const subject = `Payment failed — grace period started`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've been unable to charge your Spinzy subscription after multiple attempts. We've started a 3-day grace period until ${graceUntil.toLocaleString('en-IN')}. Your children will keep access during this time. Please update payment to avoid service interruption: <a href="${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing">Update payment</a>.</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Spinzy: grace period started until ${graceUntil.toLocaleDateString('en-IN')}. Update payment: ${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`)
      } catch (err) {
        logger.error('paymentDunning: error starting grace', { subscriptionId: s.id, error: String(err) })
      }
    }

    // 3) Send daily reminders during gracePeriod
    const subsInGrace = await prisma.subscription.findMany({ where: { active: true, graceUntil: { gt: now } } })
    for (const s of subsInGrace) {
      try {
        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, phone: true, name: true } })
        if (!parent) continue

        // Ensure once-per-day reminder via Redis key
        if (redis) {
          const dayKey = `parent:grace:reminder:${parent.id}:${new Date().toISOString().slice(0,10)}`
          const exists = await redis.get(dayKey)
          if (exists) continue
          await redis.setex(dayKey, 24 * 60 * 60, '1')
        }

        const subject = `Reminder: update payment to keep Spinzy access`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>This is a reminder that your Spinzy subscription grace period ends on ${new Date(s.graceUntil!).toLocaleString('en-IN')}. Please update payment here: <a href="${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing">Update payment</a>.</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Reminder: Spinzy grace until ${new Date(s.graceUntil!).toLocaleDateString('en-IN')}. Update payment: ${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`)
      } catch (err) {
        logger.error('paymentDunning: error sending grace reminder', { subscriptionId: s.id, error: String(err) })
      }
    }

    // 4) Expire grace: subscriptions where graceUntil has passed -> deactivate and revert child accounts
    const subsToExpire = await prisma.subscription.findMany({ where: { active: true, graceUntil: { lt: now } } })
    for (const s of subsToExpire) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({ where: { id: s.id }, data: { active: false } })

          // Revert children if meta.childIds present
          const meta: any = s.meta || {}
          const childIds: string[] = Array.isArray(meta?.childIds) ? meta.childIds : []
          for (const cid of childIds) {
            await tx.user.update({ where: { id: cid }, data: { subscriptionStatus: 'free', subscriptionExpiry: null } })
          }
        })

        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { email: true, phone: true, name: true } })
        if (parent?.email) {
          const subject = `Subscription expired — action required`
          const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>Your Spinzy subscription has expired because payment could not be completed. You can renew here: <a href="${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing">Renew subscription</a>.</p>`
          await sendMailSafe({ to: parent.email, subject, html })
        }
      } catch (err) {
        logger.error('paymentDunning: error expiring subscription', { subscriptionId: s.id, error: String(err) })
      }
    }

    logger.info('paymentDunning: completed')
  } catch (err) {
    logger.error('paymentDunning: unexpected error', { error: String(err) })
  }
}
