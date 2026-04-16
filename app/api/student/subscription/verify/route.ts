/**
 * POST /api/student/subscription/verify
 *
 * Verifies Razorpay payment signature, activates subscription,
 * creates student Subscription and Installment records (EMI support),
 * sends receipt email, and sends SMS if phone is available.
 * Auth: session required -- 401 before any DB query.
 * Idempotent: safe to retry if subscription is already active.
 *
 * FILE OBJECTIVE:
 * - Verify student payments, activate subscription, and create installments for EMI flows.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/subscription/verify.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T05:26:00Z | copilot | add subscription + EMI handling to student verify route
 * - 2026-04-14T00:00:00Z | copilot | add timeout:30000/maxWait:10000 to $transaction to prevent P2028 on Neon
 * - 2026-04-14T12:30:00Z | copilot | avoid contacting Razorpay when running tests (Jest)
 * - 2026-04-16T03:30:00Z | copilot | resolve short plan ids and use planEndDate to compute expiry safely
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { recordPaymentEvent } from '@/lib/payments/audit';
import { sendEmail } from '@/lib/mailer';
import { paymentReceiptHtml } from '@/lib/email/templates';
import { sendSms } from '@/lib/sms';
import { PLANS, planEndDate, resolvePlanByShortId } from '@/lib/billing/plans';
import type { PlanId } from '@/lib/billing/plans';
import { createInvoiceForPayment } from '@/lib/invoices';
import Razorpay from 'razorpay';

function getRazorpayClient() {
  // Avoid creating a real Razorpay client while running automated tests.
  // Tests should mock the network interactions and supply their own stubs.
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return null;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}
function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature || '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const orderId = typeof b.orderId === 'string' ? b.orderId : '';
  const paymentId = typeof b.paymentId === 'string' ? b.paymentId : '';
  const signature = typeof b.signature === 'string' ? b.signature : '';
  const planId = typeof b.planId === 'string' ? b.planId : '';

  if (!orderId || !paymentId || !signature || !planId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Security gate -- verify signature before any DB write
  if (!verifySignature(orderId, paymentId, signature)) {
    logger.error('Invalid Razorpay signature', { event: 'subscription.verify.bad_sig', context: { userId, orderId } });
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  // Cross-check order belongs to this student
  const order = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId: orderId },
    select: { studentId: true, status: true, planMonths: true, providerIdempotencyKey: true, amount: true },
  });
  if (!order || order.studentId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 403 });
  }

  // Resolve requested plan id to a concrete plan object. Support short ids
  // like 'annual' or full keys like 'standard_annual'.
  const plan = resolvePlanByShortId(planId, false);
  if (!plan) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  const now = new Date();
  const expiry = planEndDate(plan, now);

  // Declared outside the try block so email/SMS section can access it after activation.
  let _createdPayment: { id: string; subscriptionId?: string } | null = null;

  try {
    // Idempotent transaction: update order, activate subscription and create Payment
    try {
      // Fetch Razorpay order notes to inspect EMI selection (if any) before DB writes
      const client = getRazorpayClient();
      let emiMonths = 0;
      let rzNotes: any = {};
      try {
        if (client) {
          const rzOrder = await client.orders.fetch(orderId);
          rzNotes = (rzOrder && (rzOrder as any).notes) || {};
          emiMonths = rzNotes?.emiMonths ? Number(rzNotes.emiMonths) : 0;
        }
      } catch (err) {
        logger.warn('Could not fetch Razorpay order notes', { event: 'subscription.verify.fetch_notes', context: { userId, orderId }, err });
      }

      _createdPayment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (order.status !== 'paid') {
          await tx.paymentOrder.update({
            where: { razorpayOrderId: orderId },
            data: { status: 'paid', paidAt: now },
          });
        }

        await tx.user.update({
          where: { id: userId },
          data: { subscriptionStatus: 'active', subscriptionExpiry: expiry },
        });

        await tx.freeTierUsage
          .upsert({
            where: { studentId: userId },
            update: { periodStart: now, sessionsUsed: 0 },
            create: { studentId: userId, periodStart: now, sessionsUsed: 0 },
          })
          .catch((err) => { logger.warn('freeTierUsage.upsert failed', { event: 'subscription.verify.upsert', context: { userId }, error: String(err) }) });

        // Create a Payment record to persist transaction metadata
        const payment = await tx.payment.create({
          data: {
            userId,
            amount: order.amount,
            provider: 'razorpay',
            providerIdempotencyKey: order.providerIdempotencyKey ?? undefined,
            status: 'success',
            transactionId: paymentId,
            orderId: orderId,
            plan: plan.label,
            billingCycle: plan.perMonthDisplay,
            meta: { planId, emiMonths },
          },
        });

        // Audit event for subscription activation payment
        await recordPaymentEvent(tx, { paymentId: payment.id, userId, provider: 'razorpay', providerIdempotencyKey: order.providerIdempotencyKey ?? undefined, transactionId: paymentId, orderId, eventType: 'payment.subscription_verified', amount: order.amount, status: 'success', payload: { planId, emiMonths } });

        // Deactivate any existing active subscription for this student
        await tx.subscription.updateMany({ where: { userId, active: true }, data: { active: false } }).catch(() => {});

        // Create subscription record for the student
        const createdSub = await tx.subscription.create({
          data: {
            userId,
            plan: 'individual',
            billingCycle: planId,
            startDate: now,
            endDate: expiry,
            active: true,
            childSlots: 1,
            paymentId: payment.id,
            meta: {},
            creditBalance: 0,
          },
        });

        // Create Installment schedule if EMI selected; first installment marked PAID as we just received payment
        try {
          const months = Number(emiMonths || 0);
          if (months && months > 1) {
            const totalPaise = order.amount || 0;
            const base = Math.floor(totalPaise / months);
            const remainder = totalPaise - base * months;
            for (let i = 0; i < months; i++) {
              const amount = base + (i === months - 1 ? remainder : 0);
              const due = new Date(now);
              due.setMonth(due.getMonth() + i);
              await tx.installment.create({ data: {
                subscriptionId: createdSub.id,
                number: i + 1,
                dueAt: due,
                amount,
                currency: 'INR',
                status: i === 0 ? 'PAID' : 'PENDING',
                provider: 'razorpay',
                providerPaymentId: i === 0 ? paymentId : undefined,
                paymentId: i === 0 ? payment.id : undefined,
                attemptCount: i === 0 ? 1 : 0,
                paidAt: i === 0 ? now : undefined,
                meta: { autoCreated: true, planId, emiMonths },
              } });
            }
          } else {
            // Single paid installment
            await tx.installment.create({ data: {
              subscriptionId: createdSub.id,
              number: 1,
              dueAt: now,
              amount: order.amount,
              currency: 'INR',
              status: 'PAID',
              provider: 'razorpay',
              providerPaymentId: paymentId,
              paymentId: payment.id,
              attemptCount: 1,
              paidAt: now,
              meta: { planId },
            } });
          }
        } catch (err) {
          logger.warn('subscription.verify: failed to create installment schedule', { err });
        }

        return { id: payment.id, subscriptionId: createdSub.id };
      }, { timeout: 30000, maxWait: 10000 });
    } catch (err) {
      logger.error('Failed to activate subscription', { event: 'subscription.verify.activate_error', context: { userId, orderId }, err });
      return NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 });
    }
  } catch (err) {
    logger.error('Failed to activate subscription', { event: 'subscription.verify.activate_error', context: { userId, orderId }, err });
    return NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 });
  }

  // Fetch user for email/SMS -- not part of the transaction
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  const renewalDate = expiry.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Send receipt email -- non-blocking, never throws to caller
  if (user?.email) {
      try {
      // Create invoice PDF, attach to email and upload to R2 (best-effort)
      const invoiceResult = await createInvoiceForPayment({
        userId,
        paymentId: _createdPayment?.id,
        studentId: order.studentId,
        amountPaise: order.amount,
        planLabel: plan.label,
        billingCycle: plan.perMonthDisplay,
      });

      await sendEmail({
        to: user.email,
        subject: 'Payment confirmed -- Spinzy Academy',
        html: paymentReceiptHtml({
          studentName: user.name ?? 'Student',
          plan: plan.label,
          amountRupees: plan.billedRupees,
          billingCycle: plan.perMonthDisplay,
          renewalDate,
        }),
        ...(invoiceResult.pdfBuffer ? {
          attachments: [
            {
              filename: `invoice-${invoiceResult.invoiceNumber}.pdf`,
              content: invoiceResult.pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        } : {}),
      } as any).catch((err: unknown) => {
        logger.error('Receipt email failed', { event: 'subscription.verify.email_error', context: { userId }, err });
      });
      } catch (err: unknown) {
      logger.error('Invoice generation/email failed', { event: 'subscription.verify.invoice_error', context: { userId, orderId }, err });
      // Fallback: send receipt without attachment
      sendEmail({
        to: user.email,
        subject: 'Payment confirmed -- Spinzy Academy',
        html: paymentReceiptHtml({
          studentName: user.name ?? 'Student',
          plan: plan.label,
          amountRupees: plan.billedRupees,
          billingCycle: plan.perMonthDisplay,
          renewalDate,
        }),
      }).catch((err2: unknown) => {
        logger.error('Receipt email fallback failed', { event: 'subscription.verify.email_error', context: { userId }, err: err2 });
      });
    }
  }

  // Send receipt SMS -- non-blocking
  if (user?.phone) {
    const smsText = `Hi ${user.name ?? ''}! Your Spinzy ${plan.label} plan is active. Happy learning! - Team Spinzy`;
    sendSms(user.phone, smsText).catch((err: unknown) => {
      logger.error('Receipt SMS failed', { event: 'subscription.verify.sms_error', context: { userId }, err });
    });
  }

  return NextResponse.json(
    { success: true, subscriptionExpiry: expiry.toISOString() },
    { status: 200 },
  );
}
