/* eslint-disable @typescript-eslint/no-explicit-any */
// Unit tests for installmentDunningWorker

jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/payments.js', () => ({ createRazorpayTokenCharge: jest.fn() }));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock';
import { createRazorpayTokenCharge } from '@/lib/payments.js';

// Import after mocks
import { processInstallmentDunning } from '@/worker/services/installmentDunningWorker';

describe('installmentDunningWorker', () => {
  beforeEach(() => {
    resetPrismaMock();
    (createRazorpayTokenCharge as jest.Mock).mockReset();
  });

  it('charges a single installment when payment method exists', async () => {
    const inst = {
      id: 'inst-1',
      subscriptionId: 'sub-1',
      number: 1,
      amount: 10000,
      currency: 'INR',
      attemptCount: 1,
    };
    const sub = { id: 'sub-1', userId: 'parent-1', plan: 'individual', billingCycle: 'monthly' };
    const parent = { id: 'parent-1', email: 'p@example.test', phone: '99999', name: 'Parent' };
    const pm = {
      id: 'pm-1',
      userId: 'parent-1',
      provider: 'razorpay',
      providerPaymentMethodId: 'pm_1',
      verified: true,
      customer: { providerCustomerId: 'rcust_1' },
    };

    prismaMock.installment = {
      findUnique: jest.fn().mockResolvedValue(inst),
      update: jest.fn().mockResolvedValue(true),
    } as any;
    prismaMock.subscription = {
      findUnique: jest.fn().mockResolvedValue(sub),
      update: jest.fn().mockResolvedValue(sub),
    } as any;
    prismaMock.user = { findUnique: jest.fn().mockResolvedValue(parent) } as any;
    prismaMock.paymentMethod = { findFirst: jest.fn().mockResolvedValue(pm) } as any;
    prismaMock.payment = { create: jest.fn().mockResolvedValue({ id: 'pay_new' }) } as any;
    prismaMock.$transaction = jest.fn(async (cb: any) => await cb(prismaMock));

    (createRazorpayTokenCharge as jest.Mock).mockResolvedValue({
      id: 'pay_new',
      order_id: 'order_1',
    });

    await processInstallmentDunning({ notes: { subscriptionId: 'sub-1', installmentNumber: '1' } });

    expect(createRazorpayTokenCharge).toHaveBeenCalled();
    expect(prismaMock.payment.create).toHaveBeenCalled();
    expect(prismaMock.installment.update).toHaveBeenCalled();
  });

  it('increments attempt and starts grace when attempts reach 3', async () => {
    const inst = {
      id: 'inst-2',
      subscriptionId: 'sub-2',
      number: 2,
      amount: 20000,
      currency: 'INR',
      attemptCount: 2,
      lastAttemptAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    };
    const sub = { id: 'sub-2', userId: 'parent-2', plan: 'individual', billingCycle: 'monthly' };
    const parent = { id: 'parent-2', email: 'p2@example.test', phone: '99998', name: 'Parent2' };
    const pm = {
      id: 'pm-2',
      userId: 'parent-2',
      provider: 'razorpay',
      providerPaymentMethodId: 'pm_2',
      verified: true,
      customer: { providerCustomerId: 'rcust_2' },
    };

    prismaMock.installment = {
      findUnique: jest.fn().mockResolvedValue(inst),
      update: jest.fn().mockResolvedValue(true),
      findMany: jest.fn(),
    } as any;
    prismaMock.subscription = {
      findUnique: jest.fn().mockResolvedValue(sub),
      update: jest.fn().mockResolvedValue(sub),
    } as any;
    prismaMock.user = { findUnique: jest.fn().mockResolvedValue(parent) } as any;
    prismaMock.paymentMethod = { findFirst: jest.fn().mockResolvedValue(pm) } as any;
    prismaMock.payment = { create: jest.fn() } as any;
    prismaMock.$transaction = jest.fn(async (cb: any) => await cb(prismaMock));

    // Simulate charge failure
    (createRazorpayTokenCharge as jest.Mock).mockResolvedValue(null);

    await processInstallmentDunning({ notes: { subscriptionId: 'sub-2', installmentNumber: '2' } });

    // After failure, installment.update should be called to increment attemptCount
    expect(prismaMock.installment.update).toHaveBeenCalled();
    // If attemptCount reached 3, subscription.update to set graceUntil should be called
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });
});
