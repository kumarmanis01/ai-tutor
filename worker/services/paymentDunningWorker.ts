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
import { PAYMENT_DUNNING_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails'

function toIso(d: Date) { return d.toISOString() }
const DEFAULT_APP_URL = 'https://spinzyacademy.com'
const DEFAULT_SUPPORT_EMAIL = PAYMENT_DUNNING_SUPPORT_EMAIL
const RENEWAL_REMINDER_DAYS = 7

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
  const appUrl = (process.env.NEXTAUTH_URL ?? DEFAULT_APP_URL).replace(/\/$/, '')
  const supportEmail = process.env.SUPPORT_EMAIL ?? DEFAULT_SUPPORT_EMAIL

  try {
    // 0) Upcoming renewal reminder: exactly 7 days before renewal end-date.
    const reminderStart = new Date(now)
    reminderStart.setHours(0, 0, 0, 0)
    reminderStart.setDate(reminderStart.getDate() + RENEWAL_REMINDER_DAYS)
    const reminderEnd = new Date(reminderStart)
    reminderEnd.setDate(reminderEnd.getDate() + 1)

    const subsForReminder = (await prisma.subscription.findMany({
      where: {
        active: true,
        endDate: { gte: reminderStart, lt: reminderEnd },
      },
      select: { id: true, userId: true, endDate: true, billingCycle: true },
    })) as Array<{ id: string; userId: string; endDate: Date; billingCycle: string | null }>

    for (const sub of subsForReminder) {
      try {
        const dedupKey = `parent:renewal:reminder:${sub.id}:${sub.endDate.toISOString().slice(0, 10)}`
        if (redis) {
          const exists = await redis.get(dedupKey)
          if (exists) continue
        }

        const parent = await prisma.user.findUnique({ where: { id: sub.userId }, select: { email: true, phone: true, name: true } })
        if (!parent?.email && !parent?.phone) continue

        const billingLabel = sub.billingCycle ?? 'plan'
        const resolvedPlan = (sub.billingCycle && (PLANS as Record<string, { billedRupees: number }>)[sub.billingCycle])
          ? (PLANS as Record<string, { billedRupees: number }>)[sub.billingCycle]
          : null
        const renewalAmountLabel = resolvedPlan ? `INR ${resolvedPlan.billedRupees}` : 'your standard renewal amount'
        const subject = 'Upcoming renewal reminder -- Spinzy subscription'
        const cancelLink = `${appUrl}/parent/billing`
        const html = `<p>Hi ${parent?.name ?? 'Parent'},</p><p>Your Spinzy subscription renews in 7 days on <strong>${sub.endDate.toLocaleDateString('en-IN')}</strong>.</p><p>Renewal amount: <strong>${renewalAmountLabel}</strong> (${billingLabel}). You can manage or cancel renewal here: <a href="${cancelLink}">Manage billing</a>.</p>`

        if (parent?.email) {
          await sendMailSafe({ to: parent.email, subject, html })
        }
        if (parent?.phone) {
          await sendSms(parent.phone, `Spinzy renewal in 7 days (${sub.endDate.toLocaleDateString('en-IN')}). Amount ${renewalAmountLabel}. Manage/cancel: ${cancelLink}`)
        }

        if (redis) await redis.setex(dedupKey, 10 * 24 * 60 * 60, '1')
      } catch (err) {
        logger.warn('paymentDunning: renewal reminder failed', { subscriptionId: sub.id, error: String(err) })
      }
    }

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
                const invoice = await createInvoiceForPayment({ userId: s.userId, paymentId: undefined, studentId: undefined, amountPaise: 0, planLabel: plan.label, billingCycle: plan.perMonthDisplay })
                const subject = `Payment applied from credits -- Spinzy subscription`
                const nextRenewal = s.endDate ? new Date(s.endDate) : now
                const invoiceLink = invoice.fileUrl ? `<a href="${invoice.fileUrl}">Download invoice</a>` : 'Invoice will be available in your billing history.'
                const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've applied your available credits to renew your Spinzy subscription.</p><p>Plan: ${plan.label}<br/>Amount: INR 0<br/>Next renewal: ${nextRenewal.toLocaleDateString('en-IN')}<br/>Invoice: ${invoiceLink}</p>`
                await sendMailSafe({
                  to: parent.email ?? '',
                  subject,
                  html,
                  ...(invoice.pdfBuffer ? { attachments: [{ filename: `invoice-${invoice.invoiceNumber}.pdf`, content: invoice.pdfBuffer, contentType: 'application/pdf' }] } : {}),
                })
                if (parent.phone) {
                  await sendSms(parent.phone, `Payment success: INR 0 (${plan.label}). Next renewal ${nextRenewal.toLocaleDateString('en-IN')}. Invoice: ${invoice.fileUrl ?? `${appUrl}/parent/billing`}`)
                }
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
                  const invoice = await createInvoiceForPayment({ userId: s.userId, paymentId: chargePaymentId ?? undefined, studentId: undefined, amountPaise: netAmountPaise, planLabel: plan.label, billingCycle: plan.perMonthDisplay })
                  const subject = `Payment received -- Spinzy subscription`
                  const nextRenewal = s.endDate ? new Date(s.endDate) : now
                  const amountInr = (netAmountPaise / 100).toFixed(2)
                  const invoiceLink = invoice.fileUrl ? `<a href="${invoice.fileUrl}">Download invoice</a>` : 'Invoice will be available in your billing history.'
                  const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've successfully renewed your Spinzy subscription.</p><p>Amount: INR ${amountInr}<br/>Plan: ${plan.label}<br/>Next renewal: ${nextRenewal.toLocaleDateString('en-IN')}<br/>Invoice: ${invoiceLink}</p>`
                  await sendMailSafe({
                    to: parent.email ?? '',
                    subject,
                    html,
                    ...(invoice.pdfBuffer ? { attachments: [{ filename: `invoice-${invoice.invoiceNumber}.pdf`, content: invoice.pdfBuffer, contentType: 'application/pdf' }] } : {}),
                  })
                  if (parent.phone) {
                    await sendSms(parent.phone, `Payment success: INR ${amountInr} (${plan.label}). Next renewal ${nextRenewal.toLocaleDateString('en-IN')}. Invoice: ${invoice.fileUrl ?? `${appUrl}/parent/billing`}`)
                  }
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
        const retryLink = `${appUrl}/parent/billing`
        const predictedGrace = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We attempted to renew your Spinzy subscription again but couldn't complete the payment.</p><p>Retry here: <a href="${retryLink}">Update payment & retry</a></p><p>Grace period expiry (if payment is not completed): ${predictedGrace.toLocaleString('en-IN')}</p><p>Support: ${supportEmail}</p>`

        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Payment failed. Retry: ${retryLink}. Grace until ${predictedGrace.toLocaleDateString('en-IN')}. Support: ${supportEmail}`)

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
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've been unable to charge your Spinzy subscription after multiple attempts. We've started a 3-day grace period until ${graceUntil.toLocaleString('en-IN')}.</p><p>Please retry payment here: <a href="${appUrl}/parent/billing">Update payment</a></p><p>Support: ${supportEmail}</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Spinzy grace started until ${graceUntil.toLocaleDateString('en-IN')}. Retry: ${appUrl}/parent/billing. Support: ${supportEmail}`)
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
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>This is a reminder that your Spinzy subscription grace period ends on ${new Date(s.graceUntil!).toLocaleString('en-IN')}.</p><p>Update payment: <a href="${appUrl}/parent/billing">Update payment</a></p><p>Support: ${supportEmail}</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Reminder: Spinzy grace until ${new Date(s.graceUntil!).toLocaleDateString('en-IN')}. Update: ${appUrl}/parent/billing. Support: ${supportEmail}`)
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
          const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>Your Spinzy subscription has expired because payment could not be completed. You can renew here: <a href="${appUrl}/parent/billing">Renew subscription</a>.</p>`
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
