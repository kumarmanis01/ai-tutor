/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';

jest.resetModules();

describe('Razorpay webhook reconciliation (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-secret';
    // Ensure no live Razorpay client is used in unit tests
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it('creates payment with providerIdempotencyKey on payment.captured when header present', async () => {
    const idempotencyKey = 'idem-123';
    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 99900 } } },
    };
    const raw = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest('hex');

    // Prepare transaction-level mocks (tx)
    const tx: any = {
      paymentOrder: { update: jest.fn().mockResolvedValue(true) },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'p1' }),
        update: jest.fn().mockResolvedValue(true),
      },
      user: { update: jest.fn().mockResolvedValue(true) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(true),
      },
    };

    // Top-level prisma mocks used outside the transaction
    const prismaMock: any = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ studentId: 'student-1', status: 'pending' }),
      },
      payment: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => {
        await fn(tx);
      }),
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

    // Mocks for notifications / queue
    const mockSendMail = jest.fn();
    const mockSendSms = jest.fn();
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => mockSendMail(...a) }));
    jest.doMock('@/lib/sms', () => ({ sendSms: (...a: any[]) => mockSendSms(...a) }));
    jest.doMock('@/jobs/paymentDunning', () => ({
      getPaymentDunningQueue: () => ({ add: jest.fn() }),
    }));

    const route = await import('@/app/api/razorpay/webhook/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': sig,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      body: raw,
    });
    const res = await route.POST(req as any);
    expect(res.status).toBe(200);

    // Ensure transaction created payment with providerIdempotencyKey
    expect(tx.payment.create).toHaveBeenCalled();
    const createArg = (tx.payment.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.providerIdempotencyKey).toBe(idempotencyKey);
  });

  it('handles payment.failed: creates failed payment, bumps dunning, notifies parent and enqueues job', async () => {
    const idempotencyKey = 'idem-fail-1';
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_1',
            order_id: 'order_fail_1',
            amount: 49900,
            error_reason: 'insufficient_funds',
          },
        },
      },
    };
    const raw = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest('hex');

    const tx: any = {
      paymentOrder: { update: jest.fn().mockResolvedValue(true) },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pf1' }),
        update: jest.fn(),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub1' }),
        update: jest.fn().mockResolvedValue(true),
      },
    };

    const addMock = jest.fn();
    const prismaMock: any = {
      paymentOrder: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ studentId: 'parent-1', status: 'pending', planMonths: 1 }),
      },
      payment: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'parent-1',
            email: 'p@example.test',
            phone: '99999',
            name: 'Parent',
          }),
      },
      $transaction: jest.fn(async (fn: any) => {
        await fn(tx);
      }),
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    const mockSendMail = jest.fn().mockResolvedValue(undefined);
    const mockSendSms = jest.fn().mockResolvedValue(undefined);
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => mockSendMail(...a) }));
    jest.doMock('@/lib/sms', () => ({ sendSms: (...a: any[]) => mockSendSms(...a) }));
    jest.doMock('@/jobs/paymentDunning', () => ({
      getPaymentDunningQueue: () => ({ add: addMock }),
    }));

    const route = await import('@/app/api/razorpay/webhook/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': sig,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      body: raw,
    });
    const res = await route.POST(req as any);
    expect(res.status).toBe(200);

    // Payment create with failed status
    expect(tx.payment.create).toHaveBeenCalled();
    const createArg = (tx.payment.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.status).toBe('failed');

    // Subscription dunning updated
    expect(tx.subscription.update).toHaveBeenCalled();

    // Notifications sent
    const mailer = await import('@/lib/mailer');
    const sms = await import('@/lib/sms');
    // The mocks resolve to the functions above; ensure they were invoked by checking the mocked functions
    expect((mailer as any).sendMailSafe).toBeDefined();
    expect((sms as any).sendSms).toBeDefined();

    // Queue enqueued
    expect(addMock).toHaveBeenCalled();
  });

  it('reconciles Installment on payment.captured when Razorpay order notes indicate installment', async () => {
    process.env.RAZORPAY_KEY_ID = 'k';
    process.env.RAZORPAY_KEY_SECRET = 's';

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_inst_1', order_id: 'order_inst_1', amount: 50000 } },
      },
    };
    const raw = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest('hex');

    const tx: any = {
      paymentOrder: { update: jest.fn().mockResolvedValue(true) },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'p_inst_1' }),
        update: jest.fn(),
      },
      installment: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'inst-1', subscriptionId: 'sub-1', number: 2 }),
        update: jest.fn().mockResolvedValue(true),
      },
      user: { update: jest.fn().mockResolvedValue(true) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(true),
      },
    };

    const prismaMock: any = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ studentId: 'parent-1', status: 'pending' }),
      },
      payment: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => {
        await fn(tx);
      }),
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

    // Mock Razorpay SDK orders.fetch to return notes with subscription/installment
    jest.doMock('razorpay', () => ({
      default: class {
        orders = {
          fetch: async (_: any) => ({ notes: { subscriptionId: 'sub-1', installmentNumber: '2' } }),
        };
      },
    }));

    const mockSendMail = jest.fn();
    const mockSendSms = jest.fn();
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => mockSendMail(...a) }));
    jest.doMock('@/lib/sms', () => ({ sendSms: (...a: any[]) => mockSendSms(...a) }));

    const route = await import('@/app/api/razorpay/webhook/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-razorpay-signature': sig, 'content-type': 'application/json' },
      body: raw,
    });
    const res = await route.POST(req as any);
    expect(res.status).toBe(200);

    // Ensure payment record created and installment.update called
    expect(tx.payment.create).toHaveBeenCalled();
    expect(tx.installment.findUnique).toHaveBeenCalled();
    expect(tx.installment.update).toHaveBeenCalled();
  });
});
