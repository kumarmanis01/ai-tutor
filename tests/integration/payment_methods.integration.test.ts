/**
 * FILE OBJECTIVE:
 * - Integration test for payments customer → method create → verify flow
 *
 * LINKED UNIT TEST:
 * - tests/integration/payment_methods.integration.test.ts
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | add integration test for payment methods
 */

import { prisma } from '@/lib/prisma';

const hasDb = !!process.env.DATABASE_URL;

if (!hasDb) {
  test.skip('skipped integration (DATABASE_URL not set)', () => {});
} else {
  // Mock Razorpay SDK
  const mockCustomersCreate = jest.fn(async (opts) => ({ id: `rcust_${Date.now()}`, ...opts }));
  const mockPaymentsCreate = jest.fn(async (opts) => ({ id: `pay_${Date.now()}`, ...opts }));

  jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({ customers: { create: mockCustomersCreate }, payments: { create: mockPaymentsCreate } }));
  });

  describe('Payment methods flow', () => {
    let userId: string;

    beforeAll(async () => {
      process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? 'test-key-id';
      process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? 'test-secret';

      const user = await prisma.user.create({ data: { name: 'PM Test', email: 'pmtest@example.test', phone: '9999999999', language: 'en' } });
      userId = user.id;
    });

    afterAll(async () => {
      await prisma.payment.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.paymentMethod.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.paymentCustomer.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    });

    test('create customer, add payment method, verify method', async () => {
      // Set session for handlers
      (global as any).__TEST_SESSION__ = { user: { id: userId, email: 'pmtest@example.test', name: 'PM Test', phone: '9999999999' } };

      const custRoute = await import('@/app/api/payments/customer/route');
      const custReq = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      const custRes = await custRoute.POST(custReq as any);
      expect(custRes.status).toBe(200);
      const custBody = await custRes.json();
      expect(custBody.customerId).toBeTruthy();

      const dbCust = await prisma.paymentCustomer.findFirst({ where: { userId } });
      expect(dbCust).toBeTruthy();

      // Create payment method record via API
      const methodsRoute = await import('@/app/api/payments/methods/route');
      const pmReq = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerPaymentMethodId: 'tok_card_1', type: 'card', last4: '4242', cardBrand: 'Visa', expiryMonth: 12, expiryYear: 2028, customerId: dbCust!.providerCustomerId }) });
      const pmRes = await methodsRoute.POST(pmReq as any);
      expect([200,201]).toContain(pmRes.status);
      const pmBody = await pmRes.json();
      const pm = pmBody.method ?? pmBody.method;
      expect(pm).toBeTruthy();

      const dbMethod = await prisma.paymentMethod.findFirst({ where: { userId } });
      expect(dbMethod).toBeTruthy();
      expect(dbMethod!.verified).toBe(false);

      // Verify method - should trigger payments.create via mocked SDK
      const verifyRoute = await import('@/app/api/payments/methods/verify/route');
      const verifyReq = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ methodId: dbMethod!.id }) });
      const verifyRes = await verifyRoute.POST(verifyReq as any);
      expect(verifyRes.status).toBe(200);
      const verifyBody = await verifyRes.json();
      expect(verifyBody.success).toBe(true);

      const verifiedMethod = await prisma.paymentMethod.findUnique({ where: { id: dbMethod!.id } });
      expect(verifiedMethod).toBeTruthy();
      expect(verifiedMethod!.verified).toBe(true);

      const payment = await prisma.payment.findFirst({ where: { userId } });
      expect(payment).toBeTruthy();
      expect(payment!.provider).toBe('razorpay');
    });
  });
}
