/**
 * FILE OBJECTIVE:
 * - Integration test for parent subscription order + verify endpoints.
 *
 * LINKED UNIT TEST:
 * - tests/integration/parent_subscription.integration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created integration test for parent order/verify
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Integration hooks may perform DB work; increase default timeout for this file.
jest.setTimeout(30_000);

// Skip integration if no DATABASE_URL configured
const hasDb = !!process.env.DATABASE_URL;

const mockSendEmail = jest.fn();
const mockUpload = jest.fn();
const mockSendSms = jest.fn();

jest.mock('@/lib/mailer', () => ({
  sendEmail: (...a: any[]) => mockSendEmail(...a),
  sendMailSafe: (...a: any[]) => mockSendEmail(...a),
}));

jest.mock('@/lib/storage/r2', () => ({
  uploadBufferToR2: (...a: any[]) => mockUpload(...a),
}));

jest.mock('@/lib/sms', () => ({
  sendSms: (...a: any[]) => mockSendSms(...a),
}));

// Mock Razorpay client; fetchNotes can be set by the test before calling verify
let fetchNotes: any = {};
const mockOrdersCreate = jest.fn(async (opts) => ({ id: `order-parent-${Date.now()}`, notes: opts?.notes || {} }));
const mockOrdersFetch = jest.fn(async (id: string) => ({ id, notes: fetchNotes }));

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({ orders: { create: mockOrdersCreate, fetch: mockOrdersFetch } }));
});

describe('Parent subscription: order → verify integration', () => {
  if (!hasDb) {
    test.skip('skipped integration (DATABASE_URL not set)', () => {});
    return;
  }

  let parentId: string;
  let childAId: string;
  let childBId: string;
  let orderId: string;

  beforeAll(async () => {
    // Ensure Razorpay envs for getRazorpayClient + signature verification
    process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? 'test-key-id';
    process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? 'test-secret';

    // Create parent and two child users
    const parent = await prisma.user.create({ data: { name: 'Parent Tester', email: 'parent-tester@example.test', role: 'parent', language: 'en' } });
    parentId = parent.id;

    const childA = await prisma.user.create({ data: { name: 'Child A', email: 'child-a@example.test', language: 'en' } });
    childAId = childA.id;
    const childB = await prisma.user.create({ data: { name: 'Child B', email: 'child-b@example.test', language: 'en' } });
    childBId = childB.id;

    // Create ParentStudent links
    await prisma.parentStudent.create({ data: { parentId, studentId: childAId } });
    await prisma.parentStudent.create({ data: { parentId, studentId: childBId } });

    // Default mocks for storage + mail + sms
    mockUpload.mockResolvedValueOnce(`https://r2.example/${Date.now()}.pdf`);
    mockSendEmail.mockResolvedValueOnce(undefined);
    mockSendSms.mockResolvedValueOnce(undefined);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.invoice.deleteMany({ where: { userId: parentId } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { userId: parentId } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { userId: parentId } }).catch(() => {});
    await prisma.paymentOrder.deleteMany({ where: { studentId: parentId } }).catch(() => {});
    await prisma.parentStudent.deleteMany({ where: { parentId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [parentId, childAId, childBId] } } }).catch(() => {});
  });

  test('parent can create order and verify payment; children receive subscriptions and invoice sent', async () => {
    // Authorize as parent
    (global as any).__TEST_SESSION__ = { user: { id: parentId, role: 'parent', email: 'parent-tester@example.test' } };

    // Import route after mocks and session injected
    const orderRoute = await import('@/app/api/parent/subscription/order/route');

    const orderReq = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'annual', childIds: [childAId, childBId], isFamily: false }),
    });

    const orderRes = await orderRoute.POST(orderReq as any);
    expect(orderRes.status).toBe(200);
    const orderBody = await orderRes.json();
    expect(orderBody.orderId).toBeTruthy();
    orderId = orderBody.orderId;

    // Ensure paymentOrder row persisted
    const po = await prisma.paymentOrder.findUnique({ where: { razorpayOrderId: orderId } });
    expect(po).toBeTruthy();
    expect(po!.studentId).toBe(parentId);

    // Prepare Razorpay notes for fetch in verify
    fetchNotes = { childIds: JSON.stringify([childAId, childBId]), isFamily: 'false' };

    // Prepare signature
    const paymentId = `pay_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET ?? 'test-secret';
    const payload = `${orderId}|${paymentId}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Verify route
    const verifyRoute = await import('@/app/api/parent/subscription/verify/route');

    const verifyReq = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, paymentId, signature, planId: 'annual' }),
    });

    const verifyRes = await verifyRoute.POST(verifyReq as any);
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.success).toBe(true);

    // Payment record created
    const payment = await prisma.payment.findFirst({ where: { transactionId: paymentId } });
    expect(payment).toBeTruthy();

    // Invoice created and uploaded
    const invoice = await prisma.invoice.findUnique({ where: { paymentId: payment!.id } });
    expect(invoice).toBeTruthy();
    expect(invoice!.fileUrl).toBeTruthy();

    // Parent subscription created
    const sub = await prisma.subscription.findFirst({ where: { userId: parentId } });
    expect(sub).toBeTruthy();
    expect(sub!.active).toBe(true);
    expect(sub!.childSlots).toBe(2);

    // Children subscription updated
    const childA = await prisma.user.findUnique({ where: { id: childAId } });
    expect(childA).toBeTruthy();
    expect(childA!.subscriptionStatus).toBe('active');
    expect(childA!.subscriptionExpiry).toBeTruthy();

    // Email & SMS sent
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalled();
  });
});
