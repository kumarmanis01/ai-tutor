/**
 * FILE OBJECTIVE:
 * - Worker that enforces renewal retry policy and grace period for subscriptions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/workers/subscriptionRenewalWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created subscription renewal worker
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/mailer';
import { sendSms } from '@/lib/sms';

/**
 * Retry schedule (relative to first attempt):
 * - attempt 0: now (day 0)
 * - attempt 1: firstAttempt + 1 day
 * - attempt 2: firstAttempt + 3 days
 * After attempts exhausted, a grace period of 3 days is applied.
 */

function addDays(d: Date, days: number) {
  const o = new Date(d);
  o.setDate(o.getDate() + days);
  return o;
}

export async function processRenewals(now = new Date()) {
  // processRenewals called
  // 1) Create pending renewal payments for subscriptions that reached endDate
  const dueSubs = await prisma.subscription.findMany({
    where: { active: true, endDate: { lte: now } },
  });
  // dueSubs count logged via structured logger when needed

  for (const sub of dueSubs) {
    try {
      // Check if there's already a pending renewal payment for this subscription
      const existing = await prisma.payment.findFirst({
        where: { userId: sub.userId, status: 'pending', meta: { path: ['renewal'], equals: true } as any },
      });

      if (!existing) {
        // Create a pending Payment record representing the renewal attempt
        await prisma.payment.create({
          data: {
            userId: sub.userId,
            amount: Math.round( (sub as any).billingCycle ? 0 : 0 ), // amount unknown here; keep 0 if unknown
            provider: 'system',
            status: 'pending',
            meta: {
              renewal: true,
              subscriptionId: sub.id,
              attempts: 0,
              firstAttemptAt: now.toISOString(),
              nextAttemptAt: now.toISOString(),
            },
          },
        });
      }
    } catch (err) {
      logger.error('processRenewals: failed creating pending renewal', { err, subscriptionId: sub.id });
    }
  }

  // 2) Process pending renewal/EMI payments whose nextAttemptAt or dueDate <= now
  const pendingPayments = await prisma.payment.findMany({ where: { status: 'pending' } });
  // pendingPayments count logged via structured logger when needed

  const appUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.spinzyacademy.com').replace(/\/$/, '');

  for (const p of pendingPayments) {
    const meta = (p.meta || {}) as any;
    if (!meta) continue;

    // Only handle renewal payments or EMI installments
    const isRenewal = Boolean(meta.renewal);
    const isEmi = Boolean(meta.emi);
    if (!isRenewal && !isEmi) continue;

    // If this payment has already entered the grace window, skip retry processing here.
    // Grace-specific reminders and final revocation are handled in the in-grace section below.
    if (meta.inGrace) continue;

    // Determine canonical firstAttempt and nextAttempt
    const firstAttemptAt = meta.firstAttemptAt ? new Date(meta.firstAttemptAt) : (isEmi && meta.dueDate ? new Date(meta.dueDate) : p.createdAt);
    const nextAttemptAt = meta.nextAttemptAt ? new Date(meta.nextAttemptAt) : firstAttemptAt;
    if (nextAttemptAt.getTime() > now.getTime()) continue;

    const attempts = Number(meta.attempts || 0);

    // Simulate an attempt (charging logic not implemented here) => treat as failed
    if (attempts < 2) {
      const newAttempts = attempts + 1;
      let newNext: Date;
      if (newAttempts === 1) newNext = addDays(firstAttemptAt, 1);
      else newNext = addDays(firstAttemptAt, 3);

      // When first failure occurs (attempts === 0 -> newAttempts === 1), notify parent immediately
      if (attempts === 0) {
        try {
          const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, phone: true } });
          const predictedGrace = addDays(firstAttemptAt, 6); // firstAttempt + 3 (last retry) + 3 (grace)
          const graceStr = predictedGrace.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
          const retryLink = `${appUrl}/account/billing`;
          const subject = 'Payment failed — Spinzy Academy';
          const html = `<p>Hi ${user?.name ?? ''},</p><p>We attempted to renew your subscription but the payment failed. We'll retry automatically over the next few days. You can retry manually or update your payment method here: <a href="${retryLink}">Manage billing</a>.</p><p>If all retries fail, access will be suspended after approximately ${graceStr}.</p><p>— Team Spinzy</p>`;
          if (user?.email) await sendEmail({ to: user.email, subject, html }).catch((e) => logger.error('sendEmail failed (renewal first-failure)', { err: e, userId: p.userId }));
          if (user?.phone) await sendSms(user.phone, `Payment failed for your Spinzy subscription. Update payment: ${retryLink}`).catch((e) => logger.error('sendSms failed (renewal first-failure)', { err: e, userId: p.userId }));
        } catch (err) {
          logger.error('Failed to notify user on first payment failure', { err, paymentId: p.id });
        }
      }

      await prisma.payment.update({ where: { id: p.id }, data: { meta: { ...meta, attempts: newAttempts, nextAttemptAt: newNext.toISOString() } } });
    } else {
      // attempts >= 2 and this is the last scheduled retry -> enter grace
      const graceUntil = addDays(now, 3);
      const updatedMeta = { ...meta, attempts: attempts + 1, inGrace: true, graceUntil: graceUntil.toISOString() };
      // Notify user that grace has started
      try {
        const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, phone: true } });
        const subject = 'Payment overdue — access will be paused soon';
        const html = `<p>Hi ${user?.name ?? ''},</p><p>We were unable to charge your saved payment method after multiple attempts. Your account is now in a 3-day grace period and access will be suspended on ${graceUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} if payment is not received. Please update your payment method or retry now: <a href="${appUrl}/account/billing">Manage billing</a>.</p><p>— Team Spinzy</p>`;
        if (user?.email) await sendEmail({ to: user.email, subject, html }).catch((e) => logger.error('sendEmail failed (enter grace)', { err: e, userId: p.userId }));
        if (user?.phone) await sendSms(user.phone, `Payment overdue. Access will be suspended on ${graceUntil.toLocaleDateString('en-IN')}. Update: ${appUrl}/account/billing`).catch((e) => logger.error('sendSms failed (enter grace)', { err: e, userId: p.userId }));
      } catch (err) {
        logger.error('Failed to notify user on entering grace', { err, paymentId: p.id });
      }

      await prisma.payment.update({ where: { id: p.id }, data: { meta: updatedMeta } });
      logger.info('subscription:entered_grace', { subscriptionId: meta.subscriptionId, userId: p.userId, graceUntil: graceUntil.toISOString() });
    }
  }

  // 3) Handle payments in-grace where graceUntil <= now -> revoke subscription
  const inGracePayments = await prisma.payment.findMany({ where: { status: 'pending' } });
  for (const p of inGracePayments) {
    const meta = (p.meta || {}) as any;
    if (!meta || !meta.inGrace || !meta.graceUntil) continue;
    const graceUntil = new Date(meta.graceUntil);
    logger.info('subscription:in_grace_check', { paymentId: p.id, graceUntil: meta.graceUntil, now: now.toISOString(), graceExpired: graceUntil.getTime() <= now.getTime() });
    if (graceUntil.getTime() > now.getTime()) {
      // Send daily reminder while still in grace (at most once per day)
      const lastNotified = meta.lastNotifiedGraceAt ? new Date(meta.lastNotifiedGraceAt) : null;
      const shouldNotify = !lastNotified || (now.getTime() - lastNotified.getTime()) >= 24 * 60 * 60 * 1000;
      if (shouldNotify) {
        try {
          const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, phone: true } });
          const subject = 'Reminder: payment overdue — update billing';
          const html = `<p>Hi ${user?.name ?? ''},</p><p>Your account is in a grace period until ${graceUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Please update your payment method here: <a href="${appUrl}/account/billing">Manage billing</a>.</p><p>— Team Spinzy</p>`;
          if (user?.email) await sendEmail({ to: user.email, subject, html }).catch((e) => logger.error('sendEmail failed (grace reminder)', { err: e, userId: p.userId }));
          if (user?.phone) await sendSms(user.phone, `Reminder: payment overdue. Update billing: ${appUrl}/account/billing`).catch((e) => logger.error('sendSms failed (grace reminder)', { err: e, userId: p.userId }));
          await prisma.payment.update({ where: { id: p.id }, data: { meta: { ...meta, lastNotifiedGraceAt: now.toISOString() } } });
        } catch (err) {
          logger.error('Failed to send grace reminder', { err, paymentId: p.id });
        }
      }
      continue;
    }

    // grace has expired -> Revoke subscription and mark payment failed
    try {
      logger.info('subscription:grace_expired', { paymentId: p.id, subscriptionId: meta.subscriptionId, userId: p.userId, now: now.toISOString(), graceUntil: meta.graceUntil });
      logger.info('subscription:revocation_attempt', { subscriptionId: meta.subscriptionId, userId: p.userId, paymentId: p.id });
      // Debug: read the subscription row we intend to update so tests can surface mismatches
      try {
        const existingSub = await prisma.subscription.findUnique({ where: { id: meta.subscriptionId } });
        logger.info('subscription:found_before_revoke', { subscriptionId: meta.subscriptionId, found: Boolean(existingSub), subActive: existingSub?.active });
      } catch (e) {
        logger.warn('subscription:read_before_revoke_failed', { err: e, subscriptionId: meta.subscriptionId });
      }
      await prisma.$transaction(async (tx) => {
        if (meta.subscriptionId) {
          logger.info('subscription:attempt_update_by_id', { subscriptionId: meta.subscriptionId });
          try {
            const updated = await tx.subscription.update({ where: { id: meta.subscriptionId }, data: { active: false } });
            logger.info('subscription:update_result', { subscriptionId: meta.subscriptionId, active: updated.active });
          } catch (e) {
            logger.error('subscription:update_by_id_failed', { err: e, subscriptionId: meta.subscriptionId });
          }
        } else {
          logger.info('subscription:attempt_update_by_user', { userId: p.userId, now: now.toISOString() });
          const res = await tx.subscription.updateMany({ where: { userId: p.userId, active: true, endDate: { lte: now } }, data: { active: false } });
          logger.info('subscription:update_many_result', { userId: p.userId, count: res.count });
        }
        await tx.user.update({ where: { id: p.userId }, data: { subscriptionStatus: 'free' } });
        await tx.payment.update({ where: { id: p.id }, data: { status: 'failed', meta: { ...meta, failedAt: now.toISOString() } } });
      });
      try {
        const after = await prisma.subscription.findUnique({ where: { id: meta.subscriptionId } });
        logger.info('subscription:found_after_revoke', { subscriptionId: meta.subscriptionId, found: Boolean(after), subActive: after?.active });
      } catch (e) {
        logger.warn('subscription:read_after_revoke_failed', { err: e, subscriptionId: meta.subscriptionId });
      }
      logger.info('subscription:revoked', { subscriptionId: meta.subscriptionId, userId: p.userId });
    } catch (err) {
      logger.error('processRenewals: failed to revoke subscription', { err, paymentId: p.id, subscriptionId: meta.subscriptionId });
    }
  }
}

export default processRenewals;
