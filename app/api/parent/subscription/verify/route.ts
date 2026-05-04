/**
 * POST /api/parent/subscription/verify
 *
 * Verifies Razorpay payment signature for parent-initiated purchases,
 * activates subscriptions for selected child(ren), creates Payment record,
 * creates a parent Subscription record (individual or family), and sends
 * receipt email/SMS. Idempotent.
 *
 * FILE OBJECTIVE:
 * - Verify parent payments and apply subscription to child accounts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created parent verify endpoint
 * - 2026-04-14T00:00:00Z | copilot | add timeout:30000/maxWait:10000 to $transaction to prevent P2028 on Neon
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/mailer';
import { paymentReceiptHtml } from '@/lib/email/templates';
import { sendSms } from '@/lib/sms';
import { PLANS, planEndDate, resolvePlanByShortId } from '@/lib/billing/plans';
import { createInvoiceForPayment } from '@/lib/invoices';
import Razorpay from 'razorpay';
import computeProratedCredit from '@/lib/subscription/proration';
import { recordPaymentEvent } from '@/lib/payments/audit';

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

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string; role?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session?.user as any)?.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  // Accept both full plan IDs (e.g. 'standard_quarterly') and short IDs (e.g. 'quarterly').
  const resolvedPlanForParent = (PLANS as any)[planId] ?? resolvePlanByShortId(planId, false);
  if (!resolvedPlanForParent) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  // Security gate -- verify signature
  if (!verifySignature(orderId, paymentId, signature)) {
    logger.error('Invalid Razorpay signature (parent.verify)', { event: 'parent.subscription.verify.bad_sig', context: { userId, orderId } });
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  // Cross-check order belongs to this parent
  const order = await prisma.paymentOrder.findUnique({ where: { razorpayOrderId: orderId }, select: { studentId: true, status: true, planMonths: true, providerIdempotencyKey: true, amount: true } });
  if (!order || order.studentId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 403 });
  }

  const now = new Date();

  // Fetch Razorpay order to read notes (childIds, isFamily, emiMonths)
  const client = getRazorpayClient();
  let childIds: string[] = [];
  let _isFamily = false;
  let emiMonths = 0;
  let rzNotes: any = {};
  try {
    if (client) {
      const rzOrder = await client.orders.fetch(orderId);
      rzNotes = (rzOrder && (rzOrder as any).notes) || {};
      if (rzNotes?.childIds) {
        try { childIds = JSON.parse(rzNotes.childIds); } catch { childIds = [] }
      }
      _isFamily = String(rzNotes?.isFamily || '') === 'true';
      emiMonths = rzNotes?.emiMonths ? Number(rzNotes.emiMonths) : 0;
    }
  } catch (err) {
    logger.warn('Could not fetch Razorpay order notes', { event: 'parent.subscription.verify.fetch_notes', context: { userId, orderId }, err });
  }

  // Resolve plan here. Prefer an explicit family variant when _isFamily **only**
  // if the requested plan belongs to the `standard` product. This avoids
  // incorrectly mapping other product variants (e.g., `lite_monthly`) to the
  // `family_monthly` plan for the `standard` product.
  const suffix = typeof planId === 'string' && planId.includes('_') ? planId.split('_').slice(-1)[0] : planId;
  const basePlan = (PLANS as any)[planId] as any ?? resolvePlanByShortId(planId, false);
  const familyKey = (`family_${suffix}`) as any;
  const resolvedFamilyPlan = (PLANS as any)[familyKey] as any | undefined;
  const useExplicitFamily = Boolean(_isFamily && resolvedFamilyPlan && typeof planId === 'string' && planId.startsWith('standard_'));
  const appliedPlan = useExplicitFamily ? resolvedFamilyPlan : basePlan;
  const expiry = planEndDate(appliedPlan, now);

    try {
      let _createdPayment: { id: string } | null = null;
      let carryForwardCredit = 0;
    try {
      _createdPayment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (order.status !== 'paid') {
          await tx.paymentOrder.update({ where: { razorpayOrderId: orderId }, data: { status: 'paid', paidAt: now } });
        }

        // appliedPlan is resolved above (prefer explicit family variant when requested)

        // Activate parent subscription record (owner of payment)
        // Create Payment record for the parent
        const payment = await tx.payment.create({
          data: {
            userId,
            amount: order.amount,
            provider: 'razorpay',
            providerIdempotencyKey: order.providerIdempotencyKey ?? undefined,
            status: 'success',
            transactionId: paymentId,
            orderId: orderId,
            plan: appliedPlan?.label ?? String(planId),
            billingCycle: appliedPlan?.perMonthDisplay ?? '',
            meta: { planId, childIds, isFamily: _isFamily },
          },
        });

        // Audit event
        await recordPaymentEvent(tx, { paymentId: payment.id, userId, provider: 'razorpay', providerIdempotencyKey: order.providerIdempotencyKey ?? undefined, transactionId: paymentId, orderId, eventType: 'payment.parent_subscription_verified', amount: order.amount, status: 'success', payload: { planId, childIds } });

        // Compute any prorated credit from existing active subscription and carry forward
          try {
            const existing = await tx.subscription.findFirst({ where: { userId, active: true }, select: { startDate: true, endDate: true, paymentId: true, creditBalance: true } });
            if (existing) {
              const paid = existing.paymentId ? await tx.payment.findUnique({ where: { id: existing.paymentId }, select: { amount: true } }) : null;
              const paidAmount = paid?.amount ?? 0;
              const proration = computeProratedCredit(existing.startDate!, existing.endDate!, paidAmount);
              const existingCredit = existing.creditBalance ?? 0;
              carryForwardCredit = (existingCredit || 0) + (proration || 0);
              // Deactivate existing
              await tx.subscription.updateMany({ where: { userId, active: true }, data: { active: false } });
            }
          } catch (err) {
            logger.warn('parent.verify proration failed', { event: 'parent.subscription.verify.proration', context: { userId, orderId }, err });
            carryForwardCredit = 0;
          }

        // Create parent subscription record and capture it for installment creation
        const createdSub = await tx.subscription.create({
          data: {
            userId,
            plan: _isFamily ? 'family' : 'individual',
            billingCycle: planId,
            startDate: now,
            endDate: planEndDate(appliedPlan, now),
            active: true,
            childSlots: _isFamily ? (appliedPlan?.childSlots ?? (childIds?.length ?? 1)) : (childIds?.length ?? 1),
            paymentId: payment.id,
            meta: { childIds },
            creditBalance: carryForwardCredit,
          },
        });

        // Apply subscription to each child (if any childIds provided), idempotent
        if (childIds && childIds.length > 0) {
          const currentPeriodStart = new Date(now)
          currentPeriodStart.setDate(1)
          currentPeriodStart.setHours(0, 0, 0, 0)
          for (const sid of childIds) {
            await tx.user.update({ where: { id: sid }, data: { subscriptionStatus: 'active', subscriptionExpiry: expiry } });
            await tx.freeTierUsage
              .findFirst({
                where: {
                  studentId: sid,
                  subjectScope: '__ALL__',
                  periodStart: currentPeriodStart,
                },
                select: { id: true },
              })
              .then(async (existing) => {
                if (existing?.id) {
                  await tx.freeTierUsage.update({
                    where: { id: existing.id },
                    data: { sessionsUsed: 0, chapterTestsUsed: 0 },
                  })
                  return
                }
                await tx.freeTierUsage.create({
                  data: {
                    studentId: sid,
                    subjectScope: '__ALL__',
                    periodStart: currentPeriodStart,
                    sessionsUsed: 0,
                    chapterTestsUsed: 0,
                  },
                })
              })
              .catch((err) => { logger.warn('freeTierUsage.reset failed (parent.verify)', { event: 'parent.subscription.verify.reset', context: { sid }, error: String(err) }); });
          }
        }

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
                meta: { autoCreated: true, planId },
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
          logger.warn('parent.verify: failed to create installment schedule', { err });
        }

        return { paymentId: payment.id, subscriptionId: createdSub.id };
      }, { timeout: 30000, maxWait: 10000 });
    } catch (err) {
      logger.error('Failed to activate parent subscription', { event: 'parent.subscription.verify.activate_error', context: { userId, orderId }, err });
      return NextResponse.json({ error: 'Could not activate subscription' }, { status: 500 });
    }

    // Send receipt email & SMS to parent user (best-effort)
    const parent = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } });
    const renewalDate = expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    if (parent?.email) {
      try {
            const invoiceResult = await createInvoiceForPayment({ userId, paymentId: _createdPayment?.id, studentId: childIds && childIds.length > 0 ? childIds[0] : undefined, amountPaise: order.amount, planLabel: appliedPlan?.label ?? '', billingCycle: appliedPlan?.perMonthDisplay ?? '' });
        await sendEmail({
          to: parent.email,
          subject: 'Payment confirmed -- Spinzy Academy',
          html: paymentReceiptHtml({ studentName: parent.name ?? 'Student', plan: appliedPlan?.label ?? '', amountRupees: (order.amount ? (order.amount / 100) : appliedPlan?.billedRupees), billingCycle: appliedPlan?.perMonthDisplay ?? '', renewalDate }),
          ...(invoiceResult.pdfBuffer ? {
            attachments: [{ filename: `invoice-${invoiceResult.invoiceNumber}.pdf`, content: invoiceResult.pdfBuffer, contentType: 'application/pdf' }],
          } : {}),
        } as any).catch((err) => { logger.error('Receipt email failed (parent.verify)', { event: 'parent.subscription.verify.email_error', context: { userId }, err }); });
      } catch (err) {
        logger.error('Invoice generation/email failed (parent.verify)', { event: 'parent.subscription.verify.invoice_error', context: { userId, orderId }, err });
      }
    }

    if (parent?.phone) {
      const smsText = `Hi ${parent.name ?? ''}! Your Spinzy subscription is active. Happy learning! - Team Spinzy`;
      sendSms(parent.phone, smsText).catch((err: unknown) => { logger.error('Receipt SMS failed (parent.verify)', { event: 'parent.subscription.verify.sms_error', context: { userId }, err }); });
    }

    return NextResponse.json({ success: true, subscriptionExpiry: expiry.toISOString() }, { status: 200 });
  } catch (err) {
    logger.error('Unexpected error in parent subscription verify', { event: 'parent.subscription.verify.unexpected', context: { userId, orderId }, err });
    return NextResponse.json({ error: 'Could not complete verification' }, { status: 500 });
  }
}

export default POST;
