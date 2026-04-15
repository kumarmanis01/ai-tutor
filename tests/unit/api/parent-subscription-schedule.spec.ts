/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Tests for GET /api/parent/subscription/schedule (F-PAR-031 AC-06).
 */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}));
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';
import '../../helpers/mockSession';

const PARENT_ID = 'parent-1';
const STUDENT_ID = 'student-1';

function makeInstallment(overrides: any = {}) {
  return {
    id: `inst-${overrides.number ?? 1}`,
    subscriptionId: 'sub-1',
    number: 1,
    dueAt: new Date('2026-02-01'),
    amount: 39900,
    currency: 'INR',
    status: 'PENDING',
    paidAt: null,
    providerPaymentId: null,
    paymentId: null,
    attemptCount: 0,
    lastAttemptAt: null,
    meta: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeSubscription(overrides: any = {}) {
  return {
    id: 'sub-1',
    userId: PARENT_ID,
    plan: 'individual',
    billingCycle: 'annual',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    active: true,
    creditBalance: 0,
    childSlots: 1,
    meta: null,
    dunningAttempts: 0,
    lastDunningAt: null,
    graceUntil: null,
    paymentId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    installments: [makeInstallment({ number: 1 }), makeInstallment({ number: 2, dueAt: new Date('2026-03-01') })],
    ...overrides,
  };
}

describe('GET /api/parent/subscription/schedule', () => {
  beforeEach(() => {
    resetPrismaMock();
    (global as any).__TEST_SESSION__ = { user: { id: PARENT_ID, role: 'parent' } };
  });

  it('should return 401 when unauthenticated', async () => {
    (global as any).__TEST_SESSION__ = null;
    const { GET } = await import('@/app/api/parent/subscription/schedule/route');
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should return 404 when no active annual subscription exists', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/parent/subscription/schedule/route');
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(404);
  });

  it('should return EMI schedule with installments', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(makeSubscription() as any);
    const { GET } = await import('@/app/api/parent/subscription/schedule/route');
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subscriptionId).toBe('sub-1');
    expect(data.billingCycle).toBe('annual');
    expect(data.installments).toHaveLength(2);
    expect(data.installments[0].number).toBe(1);
    expect(data.installments[0].amount).toBe(39900);
    expect(data.installments[0].currency).toBe('INR');
    expect(data.installments[0].status).toBe('PENDING');
    expect(data.installments[0].paidAt).toBeNull();
  });

  it('should include paidAt when instalment is paid', async () => {
    const paidAt = new Date('2026-02-05');
    prismaMock.subscription.findFirst.mockResolvedValue(
      makeSubscription({
        installments: [makeInstallment({ number: 1, status: 'PAID', paidAt, providerPaymentId: 'pay_abc' })],
      }) as any
    );
    const { GET } = await import('@/app/api/parent/subscription/schedule/route');
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.installments[0].status).toBe('PAID');
    expect(data.installments[0].paidAt).toBe(paidAt.toISOString());
    expect(data.installments[0].providerPaymentId).toBe('pay_abc');
  });

  it('should verify student link when studentId query param supplied', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(makeSubscription() as any);
    prismaMock.parentStudent.findUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/parent/subscription/schedule/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}`);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('should return schedule when studentId is valid and link is active', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(makeSubscription() as any);
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    const { GET } = await import('@/app/api/parent/subscription/schedule/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}`);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });
});
