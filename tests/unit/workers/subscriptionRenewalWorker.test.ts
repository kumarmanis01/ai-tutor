/**
 * FILE OBJECTIVE:
 * - Unit tests for the subscription renewal worker retry/grace behaviour.
 *
 * LINKED UNIT TEST:
 * - tests/unit/workers/subscriptionRenewalWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created subscription renewal worker tests
 */

import { prisma } from '@/lib/prisma';
import processRenewals from '@/worker/services/subscriptionRenewalWorker';

// Skip DB-dependent tests when no DATABASE_URL is configured
const hasDb = !!process.env.DATABASE_URL;

describe('subscription renewal worker', () => {
  if (!hasDb) {
    test.skip('skipped (DATABASE_URL not set)', () => {});
    return;
  }

  let userId: string;
  let subId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { name: 'Renewal Tester', email: `renewal-${Date.now()}@example.test`, language: 'en' } });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  }, 30_000);

  test('retries then enters grace then revokes subscription', async () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 31);
    const end = new Date(now);
    end.setDate(end.getDate() - 1);

    const sub = await prisma.subscription.create({ data: { userId, plan: 'individual', billingCycle: 'monthly', startDate: start, endDate: end, active: true } });
    subId = sub.id;

    // Run worker initial
    await processRenewals(now);

    // There should be a pending payment representing the renewal
    let p = await prisma.payment.findFirst({ where: { userId, status: 'pending' } });
    expect(p).toBeTruthy();
    let meta: any = p!.meta || {};
    // After first run attempts should have incremented to 1
    expect(Number(meta.attempts || 0)).toBeGreaterThanOrEqual(1);

    const firstAttemptAt = new Date(meta.firstAttemptAt || p!.createdAt);

    // Run worker at firstAttempt + 1 day
    const t1 = new Date(firstAttemptAt);
    t1.setDate(t1.getDate() + 1);
    await processRenewals(t1);

    p = await prisma.payment.findUnique({ where: { id: p!.id } });
    meta = p!.meta || {};
    expect(Number(meta.attempts || 0)).toBeGreaterThanOrEqual(2);

    // Run worker at firstAttempt + 3 days
    const t2 = new Date(firstAttemptAt);
    t2.setDate(t2.getDate() + 3);
    await processRenewals(t2);

    p = await prisma.payment.findUnique({ where: { id: p!.id } });
    meta = p!.meta || {};
    expect(meta.inGrace).toBeTruthy();
    expect(meta.graceUntil).toBeTruthy();

    // Run worker after grace period -> subscription revoked
    const graceUntil = new Date(meta.graceUntil);
    const t3 = new Date(graceUntil);
    t3.setMinutes(t3.getMinutes() + 1);
    await processRenewals(t3);

    const updatedSub = await prisma.subscription.findUnique({ where: { id: subId } });
    // Debug info when test fails
    const allPayments = await prisma.payment.findMany({ where: { userId } });
    const u = await prisma.user.findUnique({ where: { id: userId } });
    // Log metadata to aid debugging
    // eslint-disable-next-line no-console
    console.log('payments:', allPayments.map((p) => ({ id: p.id, status: p.status, meta: p.meta })));
    // eslint-disable-next-line no-console
    console.log('subscription.active:', updatedSub?.active, 'user.subscriptionStatus:', u?.subscriptionStatus);
    expect(updatedSub?.active).toBe(false);
    expect(u?.subscriptionStatus).toBe('free');
  }, 30_000);
});
