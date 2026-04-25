/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
// Unit tests for paymentDunningWorker auto-charge path

// Mock prisma and logger before importing worker
jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock payments helper
jest.mock('@/lib/payments.js', () => ({ createRazorpayTokenCharge: jest.fn() }));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock';

// Import after mocks
import { processPaymentDunning } from '@/worker/services/paymentDunningWorker';
import { createRazorpayTokenCharge } from '@/lib/payments.js';

describe('paymentDunningWorker - auto-charge', () => {
  beforeEach(() => {
    resetPrismaMock();
    (createRazorpayTokenCharge as jest.Mock).mockReset();
    // Ensure subscription & payment model mocks exist on prismaMock for this test
    prismaMock.subscription = {
      findMany: jest.fn(),
      update: jest.fn(),
      // other methods used in tests
    } as any;
    prismaMock.payment = {
      create: jest.fn(),
    } as any;
  });

  it('charges when verified payment method exists and extends subscription', async () => {
    const now = new Date(Date.now() - 26 * 60 * 60 * 1000); // 26 hours ago
    // subscription eligible for attempt
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        userId: 'parent-1',
        plan: 'individual',
        billingCycle: 'monthly',
        dunningAttempts: 1,
        lastDunningAt: now,
        endDate: null,
        meta: { childIds: ['child-1'] },
      },
    ]);

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'parent-1',
      email: 'p@example.com',
      phone: '9999999999',
      name: 'Parent',
    });
    prismaMock.paymentMethod.findFirst.mockResolvedValue({
      id: 'pm-1',
      userId: 'parent-1',
      provider: 'razorpay',
      providerPaymentMethodId: 'pm_1',
      verified: true,
      customer: { providerCustomerId: 'rcust_1' },
    });

    // Mock transaction to call callback with prismaMock
    prismaMock.$transaction.mockImplementation(async (cb: any) => await cb(prismaMock));
    prismaMock.payment.create.mockResolvedValue({ id: 'pay_123' });
    prismaMock.subscription.update.mockResolvedValue({ id: 'sub-1' });
    prismaMock.user.update.mockResolvedValue({ id: 'child-1' });

    // Mock payment helper success
    (createRazorpayTokenCharge as jest.Mock).mockResolvedValue({
      id: 'pay_123',
      order_id: 'order_1',
    });

    await processPaymentDunning();

    expect(createRazorpayTokenCharge).toHaveBeenCalled();
    expect(prismaMock.payment.create).toHaveBeenCalled();
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });

  it('falls back to reminder when charge fails', async () => {
    const now = new Date(Date.now() - 26 * 60 * 60 * 1000);
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-2',
        userId: 'parent-2',
        plan: 'individual',
        billingCycle: 'monthly',
        dunningAttempts: 1,
        lastDunningAt: now,
        endDate: null,
        meta: {},
      },
    ]);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'parent-2',
      email: 'p2@example.com',
      phone: '9999999998',
      name: 'Parent2',
    });
    prismaMock.paymentMethod.findFirst.mockResolvedValue(null);

    // Ensure charge helper not called and reminder increments attempts
    (createRazorpayTokenCharge as jest.Mock).mockResolvedValue(null);
    prismaMock.subscription.update.mockResolvedValue({ id: 'sub-2' });

    await processPaymentDunning();

    expect(createRazorpayTokenCharge).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });
});
