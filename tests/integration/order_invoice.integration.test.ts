import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Skip integration if no DATABASE_URL configured
const hasDb = !!process.env.DATABASE_URL;

const mockSendEmail = jest.fn();
const mockUpload = jest.fn();

jest.mock('@/lib/mailer', () => ({
  sendEmail: (...a: any[]) => mockSendEmail(...a),
  sendMailSafe: (...a: any[]) => mockSendEmail(...a),
}));

jest.mock('@/lib/storage/r2', () => ({
  uploadBufferToR2: (...a: any[]) => mockUpload(...a),
}));

describe('Order → Verify → Invoice integration', () => {
  if (!hasDb) {
    test.skip('skipped integration (DATABASE_URL not set)', () => {});
    return;
  }

  let userId: string;
  let orderId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({ data: { name: 'Test Parent', email: 'parent-invoice@test.local', language: 'en' } });
    userId = user.id;

    // Create a paymentOrder row
    const order = await prisma.paymentOrder.create({
      data: {
        studentId: userId,
        razorpayOrderId: `order-invoice-${Date.now()}`,
        amount: 105138,
        currency: 'INR',
        status: 'created',
        planMonths: 12,
      },
    });
    orderId = order.razorpayOrderId;

    // Default mocks
    mockUpload.mockResolvedValueOnce(`https://r2.example/${orderId}.pdf`);
    mockSendEmail.mockResolvedValueOnce(undefined);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.invoice.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.paymentOrder.deleteMany({ where: { studentId: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  test('creates invoice and sends email with PDF attachment', async () => {
    // Inject test session so route authorizes
    (global as any).__TEST_SESSION__ = { user: { id: userId, email: 'parent-invoice@test.local' } };

    // Prepare signature matching verify route
    const paymentId = `pay_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET ?? 'test-secret';
    const payload = `${orderId}|${paymentId}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Import route after mocking
    const route = await import('@/app/api/student/subscription/verify/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, paymentId, signature, planId: 'annual' }),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Find the payment created
    const payment = await prisma.payment.findFirst({ where: { transactionId: paymentId } });
    expect(payment).toBeTruthy();

    // Find invoice linked to the payment
    const invoice = await prisma.invoice.findUnique({ where: { paymentId: payment!.id } });
    expect(invoice).toBeTruthy();
    expect(invoice!.fileUrl).toBeTruthy();

    // Email should have been sent with attachment
    expect(mockSendEmail).toHaveBeenCalled();
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs).toHaveProperty('to');
    expect(emailArgs).toHaveProperty('attachments');
    expect(Array.isArray(emailArgs.attachments)).toBe(true);
    const att = emailArgs.attachments[0];
    expect(att.filename).toMatch(/invoice-\d+\.pdf/);
  });
});
