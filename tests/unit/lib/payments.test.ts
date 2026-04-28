/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock Razorpay SDK and test createRazorpayTokenCharge helper

jest.resetModules();

describe('createRazorpayTokenCharge', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns payment object when SDK payments.create succeeds', async () => {
    // Ensure env present for getRazorpay
    process.env.RAZORPAY_KEY_ID = 'key';
    process.env.RAZORPAY_KEY_SECRET = 'secret';

    // Mock the razorpay module used by lib/payments.ts
    jest.doMock('razorpay', () => {
      return jest.fn().mockImplementation(() => ({
        payments: { create: jest.fn().mockResolvedValue({ id: 'pay_123', order_id: 'order_abc' }) },
      }));
    });

    const { createRazorpayTokenCharge } = await import('@/lib/payments.js');

    const resp = await createRazorpayTokenCharge({
      amountPaise: 9900,
      customerId: 'rcust_1',
      token: 'pm_1',
    });
    expect(resp).toBeTruthy();
    expect(resp.id || resp.razorpay_payment_id || resp.payment_id).toBe('pay_123');
  });

  it('returns null when SDK create throws', async () => {
    process.env.RAZORPAY_KEY_ID = 'key';
    process.env.RAZORPAY_KEY_SECRET = 'secret';

    jest.doMock('razorpay', () => {
      return jest.fn().mockImplementation(() => ({
        payments: { create: jest.fn().mockRejectedValue(new Error('fail')) },
      }));
    });

    const { createRazorpayTokenCharge } = await import('@/lib/payments.js');
    const resp = await createRazorpayTokenCharge({
      amountPaise: 9900,
      customerId: 'rcust_1',
      token: 'pm_1',
    });
    expect(resp).toBeNull();
  });
});
