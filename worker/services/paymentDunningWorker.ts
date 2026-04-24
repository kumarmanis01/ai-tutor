/**
 * Payment dunning processor.
 * - Sends retry reminders on schedule (day 1, day 3) for subscriptions with failed payments
 * - Starts a 3-day grace period after 3 failed attempts and notifies parent
 * - Deactivates subscription and reverts child accounts after grace period expires
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { getRedis } from '@/lib/redis'
import { createRazorpayTokenCharge } from '@/lib/payments'
import { PLANS, rupeesToPaise } from '@/lib/billing/plans'
import { createInvoiceForPayment } from '@/lib/invoices'
import applyCreditsToCharge from '@/lib/billing/credits'
import { recordPaymentEvent } from '@/lib/payments/audit'

function toIso(d: Date) { return d.toISOString() }

// Local row types for strict-mode
type SubscriptionRow = {
  id: string
  userId: string
  plan?: string | null
  billingCycle?: string | null
  dunningAttempts?: number | null
  lastDunningAt?: Date | string | null
  endDate?: Date | string | null
  creditBalance?: number | null
  meta?: any
  graceUntil?: Date | null
}

type PaymentMethodRow = {
  id?: string
  userId?: string
  provider?: string | null
  providerPaymentMethodId?: string | null
  verified?: boolean | null
  customer?: { providerCustomerId?: string | null } | null
}

type ParentRow = { id: string; email?: string | null; phone?: string | null; name?: string | null }

export async function processPaymentDunning(): Promise<void> {
  const now = new Date()
  const redis = getRedis()

  try {
    // 1) Handle scheduled retry attempts (attempts 1 or 2)
    const subs = (await prisma.subscription.findMany({ where: { active: true, dunningAttempts: { gt: 0, lt: 3 } } })) as SubscriptionRow[]

    for (const s of subs) {
      try {
        if (!s.lastDunningAt) continue
        const attempts = s.dunningAttempts ?? 0
        const elapsedMs = now.getTime() - new Date(s.lastDunningAt).getTime()
        const shouldRunNext = (attempts === 1 && elapsedMs >= 24 * 60 * 60 * 1000) || (attempts === 2 && elapsedMs >= 2 * 24 * 60 * 60 * 1000)
        if (!shouldRunNext) continue

        const parent = (await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, phone: true, name: true } })) as ParentRow | null
        if (!parent) continue

        const pm = (await prisma.paymentMethod.findFirst({ where: { userId: s.userId, verified: true }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }], include: { customer: true } })) as PaymentMethodRow | null
        let charged = false
        let chargePaymentId: string | null = null
        let chargeOrderId: string | null = null

        if (pm && pm.provider === 'razorpay') {
          try {
            // resolve legacy billingCycle values to new plan keys when present
            const rawKey = (s.billingCycle || 'standard_monthly') as string
            const resolvePlanKey = (k: string): keyof typeof PLANS => {
              if ((PLANS as any)[k]) return k as keyof typeof PLANS
              if (k === 'monthly') return 'standard_monthly'
              if (k === 'quarterly') return 'family_monthly'
              if (k === 'annual') return 'standard_annual'
              return 'standard_monthly'
            }
            const planKey = resolvePlanKey(rawKey)
            const plan = PLANS[planKey]
            const amountPaise = rupeesToPaise(plan.billedRupees)

            const { netAmountPaise, remainingCreditPaise } = applyCreditsToCharge(amountPaise, s.creditBalance ?? 0)
            const idempotencyKey = `subscription:${s.id}:dunning:${attempts + 1}`

            if (netAmountPaise === 0) {
              // apply credits and extend subscription
              await prisma.$transaction(async (tx) => {
                await tx.payment.create({ data: {
                  userId: s.userId,
                  amount: 0,
                  provider: 'credit',
                  providerIdempotencyKey: idempotencyKey,
                  status: 'success',
                  transactionId: `credit_applied_${Date.now()}`,
                  orderId: undefined,
                  plan: s.plan,
                  billingCycle: s.billingCycle,
                  meta: { subscriptionId: s.id, autoCharge: true, creditApplied: (s.creditBalance ?? 0) },
                } })

                await recordPaymentEvent(tx, { userId: s.userId, provider: 'credit', providerIdempotencyKey: idempotencyKey, eventType: 'charge.credit_applied', amount: 0, status: 'success', payload: { subscriptionId: s.id } })

                const planMonths = plan.durationMonths || 1
                const currentEnd = s.endDate ? new Date(s.endDate) : new Date()
                if (currentEnd.getTime() < now.getTime()) currentEnd.setTime(now.getTime())
                const newEnd = new Date(currentEnd)
                newEnd.setMonth(newEnd.getMonth() + planMonths)

                await tx.subscription.update({ where: { id: s.id }, data: { dunningAttempts: 0, lastDunningAt: null, graceUntil: null, endDate: newEnd, creditBalance: remainingCreditPaise } })

                const meta: any = s.meta || {}
                const childIds: string[] = Array.isArray(meta?.childIds) ? meta.childIds : []
                for (const cid of childIds) {
                  await tx.user.update({ where: { id: cid }, data: { subscriptionStatus: 'active', subscriptionExpiry: newEnd } })
                }
              })

                try {
                await createInvoiceForPayment({ userId: s.userId, paymentId: undefined, studentId: undefined, amountPaise: 0, planLabel: plan.label, billingCycle: plan.perMonthDisplay })
                const subject = `Payment applied from credits -- Spinzy subscription`
                const nextRenewal = s.endDate ? new Date(s.endDate) : now
                const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've applied your available credits to renew your Spinzy subscription. Your next renewal is on ${nextRenewal.toLocaleDateString('en-IN')}.</p>`
                await sendMailSafe({ to: parent.email ?? '', subject, html })
              } catch (err) {
                logger.warn('paymentDunning: invoice/email after credit-apply failed', { subscriptionId: s.id, err: String(err) })
              }

              charged = true
            } else {
              const resp = await createRazorpayTokenCharge({
                amountPaise: netAmountPaise,
                currency: 'INR',
                customerId: pm.customer?.providerCustomerId,
                token: pm.providerPaymentMethodId,
                email: parent.email ?? '',
                contact: parent.phone ?? '',
                description: `Auto charge for subscription ${s.id}`,
                notes: { subscriptionId: s.id, attempt: String(attempts + 1) },
                idempotencyKey,
              })

              const paymentId = resp && (resp.id || resp.razorpay_payment_id || resp.payment_id || resp.transactionId) || null
              const orderId = resp && (resp.order_id || resp.razorpay_order_id || resp.orderId) || null

              if (paymentId) {
                await prisma.$transaction(async (tx) => {
                  await tx.payment.create({ data: {
                    userId: s.userId,
                    amount: netAmountPaise,
                    provider: 'razorpay',
                    providerIdempotencyKey: idempotencyKey,
                    status: 'success',
                    transactionId: paymentId,
                    orderId: orderId ?? undefined,
                    plan: s.plan,
                    billingCycle: s.billingCycle,
                    meta: { subscriptionId: s.id, autoCharge: true, creditApplied: (s.creditBalance ?? 0) },
                  } })

                  await recordPaymentEvent(tx, { userId: s.userId, provider: 'razorpay', providerIdempotencyKey: idempotencyKey, transactionId: paymentId, orderId: orderId ?? undefined, eventType: 'charge.succeeded', amount: netAmountPaise, status: 'success', payload: { subscriptionId: s.id, autoCharge: true } })

                  const planMonths = plan.durationMonths || 1
                  const currentEnd = s.endDate ? new Date(s.endDate) : new Date()
                  if (currentEnd.getTime() < now.getTime()) currentEnd.setTime(now.getTime())
                  const newEnd = new Date(currentEnd)
                  newEnd.setMonth(newEnd.getMonth() + planMonths)

                  await tx.subscription.update({ where: { id: s.id }, data: { dunningAttempts: 0, lastDunningAt: null, graceUntil: null, endDate: newEnd, creditBalance: remainingCreditPaise } })

                  const meta: any = s.meta || {}
                  const childIds: string[] = Array.isArray(meta?.childIds) ? meta.childIds : []
                  for (const cid of childIds) {
                    await tx.user.update({ where: { id: cid }, data: { subscriptionStatus: 'active', subscriptionExpiry: newEnd } })
                  }
                })

                chargePaymentId = paymentId
                chargeOrderId = orderId
                charged = true

                try {
                  await createInvoiceForPayment({ userId: s.userId, paymentId: chargePaymentId ?? undefined, studentId: undefined, amountPaise: netAmountPaise, planLabel: plan.label, billingCycle: plan.perMonthDisplay })
                  const subject = `Payment received -- Spinzy subscription`
                  const nextRenewal = s.endDate ? new Date(s.endDate) : now
                  const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've successfully renewed your Spinzy subscription. Your next renewal is on ${nextRenewal.toLocaleDateString('en-IN')}.</p>`
                  await sendMailSafe({ to: parent.email ?? '', subject, html })
                } catch (err) {
                  logger.warn('paymentDunning: invoice/email after auto-charge failed', { subscriptionId: s.id, err: String(err) })
                }
              }
            }
          } catch (err) {
            logger.error('paymentDunning: auto-charge attempt failed', { subscriptionId: s.id, error: String(err) })
          }
        }

        if (charged) {
          logger.info('paymentDunning: auto-charge succeeded', { subscriptionId: s.id, paymentId: chargePaymentId })
          continue
        }

        // fallback: send reminder and bump attempts
        const subject = `Payment retry reminder -- Spinzy subscription`
        const retryLink = `${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We attempted to renew your Spinzy subscription again but couldn't complete the payment. Please retry here: <a href="${retryLink}">Update payment & retry</a></p><p>If you need help, contact support at ${process.env.SUPPORT_EMAIL ?? 'support@spinzyacademy.com'}.</p>`

        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Subscription retry: please update payment at ${retryLink}`)

        await prisma.subscription.update({ where: { id: s.id }, data: { dunningAttempts: { increment: 1 }, lastDunningAt: now } })
      } catch (err) {
        logger.error('paymentDunning: error processing retry attempt', { subscriptionId: s.id, error: String(err) })
      }
    }

    // 2) Start grace when attempts hit 3 (if not already started) and notify parent
    const subsToGrace = (await prisma.subscription.findMany({ where: { active: true, dunningAttempts: { gte: 3 }, graceUntil: null } })) as SubscriptionRow[]
    for (const s of subsToGrace) {
      try {
        const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        await prisma.subscription.update({ where: { id: s.id }, data: { graceUntil } })

        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, phone: true, name: true } })
        if (!parent) continue
        const subject = `Payment failed -- grace period started`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've been unable to charge your Spinzy subscription after multiple attempts. We've started a 3-day grace period until ${graceUntil.toLocaleString('en-IN')}. Your children will keep access during this time. Please update payment to avoid service interruption: <a href="${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing">Update payment</a>.</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Spinzy: grace period started until ${graceUntil.toLocaleDateString('en-IN')}. Update payment: ${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`)
      } catch (err) {
        logger.error('paymentDunning: error starting grace', { subscriptionId: s.id, error: String(err) })
      }
    }

    // 3) Send daily reminders during gracePeriod
    const subsInGrace = (await prisma.subscription.findMany({ where: { active: true, graceUntil: { gt: now } } })) as SubscriptionRow[]
    for (const s of subsInGrace) {
      try {
        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, phone: true, name: true } })
        if (!parent) continue

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
    const subsToExpire = (await prisma.subscription.findMany({ where: { active: true, graceUntil: { lt: now } } })) as SubscriptionRow[]
    for (const s of subsToExpire) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({ where: { id: s.id }, data: { active: false } })

          const meta: any = s.meta || {}
          const childIds: string[] = Array.isArray(meta?.childIds) ? meta.childIds : []
          for (const cid of childIds) {
            await tx.user.update({ where: { id: cid }, data: { subscriptionStatus: 'free', subscriptionExpiry: null } })
          }
        })

        const parent = await prisma.user.findUnique({ where: { id: s.userId }, select: { email: true, phone: true, name: true } })
        if (parent?.email) {
          const subject = `Subscription expired -- action required`
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
