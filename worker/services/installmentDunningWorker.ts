/**
 * FILE OBJECTIVE:
 * - Worker service that processes installment-level dunning and retry attempts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/installmentDunningWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | created
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { createRazorpayTokenCharge } from '@/lib/payments'
import { createInvoiceForPayment } from '@/lib/invoices'
import { recordPaymentEvent } from '@/lib/payments/audit'

function toIso(d: Date) { return d.toISOString() }

/**
 * Process installment dunning.
 * - If jobData contains notes with subscriptionId/installmentNumber, process that installment only (immediate retry).
 * - Otherwise, scan for failed installments with attemptCount 1 or 2 and re-attempt according to schedule.
 */
export async function processInstallmentDunning(jobData?: any): Promise<void> {
  const now = new Date()

  try {
    // Targeted job: webhook enqueued with notes
    if (jobData && jobData.notes && (jobData.notes.subscriptionId || jobData.notes.subscription_id)) {
      const subscriptionId = jobData.notes.subscriptionId || jobData.notes.subscription_id || jobData.notes.subscription
      const installmentNumberRaw = jobData.notes.installmentNumber || jobData.notes.installment_no || jobData.notes.installment || jobData.notes.installmentIndex || jobData.notes.installment_index
      const installmentNumber = installmentNumberRaw ? Number(installmentNumberRaw) : null
      if (subscriptionId && installmentNumber) {
        const inst = await prisma.installment.findUnique({ where: { subscriptionId_number: { subscriptionId: String(subscriptionId), number: Number(installmentNumber) } } })
        if (inst) {
          await attemptInstallmentCharge(inst)
        }
      }
      return
    }

    // Periodic scan: find installments with failed attempts that are eligible for retry
    const failed = await prisma.installment.findMany({ where: { status: 'FAILED', attemptCount: { gt: 0, lt: 3 } } })
    for (const inst of failed) {
      try {
        if (!inst.lastAttemptAt) continue
        const attempts = inst.attemptCount ?? 0
        const elapsedMs = now.getTime() - new Date(inst.lastAttemptAt).getTime()
        const shouldRunNext = (attempts === 1 && elapsedMs >= 24 * 60 * 60 * 1000) || (attempts === 2 && elapsedMs >= 2 * 24 * 60 * 60 * 1000)
        if (!shouldRunNext) continue
        await attemptInstallmentCharge(inst)
      } catch (err) {
        logger.error('installmentDunning: error processing installment', { installmentId: inst.id, error: String(err) })
      }
    }
  } catch (err) {
    logger.error('installmentDunning: unexpected error', { error: String(err) })
  }
}

async function attemptInstallmentCharge(inst: any): Promise<void> {
  const now = new Date()
  const subscription = await prisma.subscription.findUnique({ where: { id: inst.subscriptionId } })
  if (!subscription) return

  const parent = await prisma.user.findUnique({ where: { id: subscription.userId }, select: { id: true, email: true, phone: true, name: true } })
  if (!parent) return

  const pm = await prisma.paymentMethod.findFirst({ where: { userId: subscription.userId, verified: true }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }], include: { customer: true } })

  // If no payment method, just record attempt and exit (parent will be reminded)
  if (!pm) {
    await prisma.installment.update({ where: { id: inst.id }, data: { attemptCount: { increment: 1 }, lastAttemptAt: now } })
    return
  }

  try {
    const idempotencyKey = `installment:${inst.id}:attempt:${(inst.attemptCount ?? 0) + 1}`
    const resp = await createRazorpayTokenCharge({
      amountPaise: inst.amount,
      currency: inst.currency || 'INR',
      customerId: pm.customer?.providerCustomerId,
      token: pm.providerPaymentMethodId,
      email: parent.email ?? '',
      contact: parent.phone ?? '',
      description: `Auto retry for installment ${inst.number} of subscription ${subscription.id}`,
      notes: { subscriptionId: subscription.id, installmentNumber: inst.number },
      idempotencyKey,
    })

    if (resp) {
      const paymentId = resp.id || resp.razorpay_payment_id || resp.payment_id || resp.transactionId || null
      // Persist payment and mark installment paid
      await prisma.$transaction(async (tx) => {
        const newPayment = await tx.payment.create({ data: {
          userId: subscription.userId,
          amount: inst.amount,
          provider: 'razorpay',
          providerIdempotencyKey: idempotencyKey,
          status: 'success',
          transactionId: paymentId ?? undefined,
          orderId: resp.order_id || undefined,
          plan: subscription.plan,
          billingCycle: subscription.billingCycle,
          meta: { subscriptionId: subscription.id, installmentNumber: inst.number, autoCharge: true },
        } })

        await recordPaymentEvent(tx, { paymentId: newPayment.id, userId: subscription.userId, provider: 'razorpay', providerIdempotencyKey: idempotencyKey, transactionId: paymentId ?? undefined, orderId: resp.order_id ?? undefined, eventType: 'installment.charge.succeeded', amount: inst.amount, status: 'success', payload: { installmentId: inst.id } })

        await tx.installment.update({ where: { id: inst.id }, data: { status: 'PAID', providerPaymentId: paymentId ?? undefined, paymentId: newPayment.id, paidAt: now, attemptCount: { increment: 1 } } })
      })

      try {
        await createInvoiceForPayment({ userId: subscription.userId, paymentId: undefined, studentId: undefined, amountPaise: inst.amount, planLabel: '', billingCycle: '' })
        const subject = `Payment received -- Spinzy installment paid`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've successfully received payment for installment #${inst.number} of your subscription.</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
      } catch (err) {
        logger.warn('installmentDunning: invoice/email after installment charge failed', { installmentId: inst.id, err: String(err) })
      }

      return
    }

    // Charge attempt failed: increment attemptCount and maybe start grace
    await prisma.installment.update({ where: { id: inst.id }, data: { attemptCount: { increment: 1 }, lastAttemptAt: now, status: 'FAILED' } })

    // Compute attempts deterministically from known state rather than re-querying.
    const attempts = (inst.attemptCount ?? 0) + 1
    if (attempts >= 3) {
      // Start subscription-level grace (per-installment graceful handling)
      const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      await prisma.subscription.update({ where: { id: subscription.id }, data: { graceUntil } })
      try {
        const subject = `Payment failed -- grace period started`
        const html = `<p>Hi ${parent.name ?? 'Parent'},</p><p>We've been unable to collect the installment #${inst.number} for your Spinzy subscription after multiple attempts. We've started a 3-day grace period until ${graceUntil.toLocaleString('en-IN')}. Your children will keep access during this time. Please update payment to avoid service interruption: <a href="${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing">Update payment</a>.</p>`
        await sendMailSafe({ to: parent.email ?? '', subject, html })
        if (parent.phone) await sendSms(parent.phone, `Spinzy: grace period started until ${graceUntil.toLocaleDateString('en-IN')}. Update payment: ${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/parent/billing`)
      } catch (err) {
        logger.error('installmentDunning: error notifying parent about grace', { installmentId: inst.id, error: String(err) })
      }
    }
  } catch (err) {
    logger.error('installmentDunning: error attempting charge', { installmentId: inst.id, error: String(err) })
  }
}
