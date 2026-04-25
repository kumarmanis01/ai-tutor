/**
 * Integration tests for POST /api/admin/payments/[id]/refund
 * F-ADM-021 AC-02: Admin manual refund capability.
 */

const mockTransaction = jest.fn();
const mockPaymentFindUnique = jest.fn();
const mockPaymentUpdate = jest.fn();
const mockPaymentEventCreate = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: (...a: any[]) => mockPaymentFindUnique(...a),
      update: (...a: any[]) => mockPaymentUpdate(...a),
    },
    paymentEvent: { create: (...a: any[]) => mockPaymentEventCreate(...a) },
    auditLog: { create: (...a: any[]) => mockAuditCreate(...a) },
    $transaction: (...a: any[]) => mockTransaction(...a),
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

const { getServerSessionForHandlers } = require('@/lib/session');

beforeEach(() => {
  jest.resetAllMocks();
  (getServerSessionForHandlers as jest.Mock).mockResolvedValue({
    user: { id: 'admin1', role: 'admin' },
  });
  mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
});

describe('POST /api/admin/payments/[id]/refund', () => {
  const PAYMENT = {
    id: 'pay1',
    userId: 'u1',
    amount: 9900,
    provider: 'razorpay',
    status: 'captured',
  };

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/admin/payments/pay1/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as any;
  }

  test('marks payment as refunded and returns ok', async () => {
    mockPaymentFindUnique.mockResolvedValue(PAYMENT);
    mockPaymentUpdate.mockResolvedValue({ ...PAYMENT, status: 'refunded' });
    mockPaymentEventCreate.mockResolvedValue({});
    mockAuditCreate.mockResolvedValue({});

    const route = await import('@/app/api/admin/payments/[id]/refund/route');
    const res = await route.POST(makeRequest({ reason: 'student request' }), {
      params: Promise.resolve({ id: 'pay1' }),
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('returns 403 for non-admin', async () => {
    (getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'student' },
    });
    const route = await import('@/app/api/admin/payments/[id]/refund/route');
    const res = await route.POST(makeRequest({ reason: 'x' }), {
      params: Promise.resolve({ id: 'pay1' }),
    } as any);
    expect(res.status).toBe(403);
  });

  test('returns 400 when reason is empty', async () => {
    const route = await import('@/app/api/admin/payments/[id]/refund/route');
    const res = await route.POST(makeRequest({ reason: '' }), {
      params: Promise.resolve({ id: 'pay1' }),
    } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason_required');
  });

  test('returns 404 when payment not found', async () => {
    mockPaymentFindUnique.mockResolvedValue(null);
    const route = await import('@/app/api/admin/payments/[id]/refund/route');
    const res = await route.POST(makeRequest({ reason: 'test' }), {
      params: Promise.resolve({ id: 'nonexistent' }),
    } as any);
    expect(res.status).toBe(404);
  });

  test('returns 409 when payment already refunded', async () => {
    mockPaymentFindUnique.mockResolvedValue({ ...PAYMENT, status: 'refunded' });
    const route = await import('@/app/api/admin/payments/[id]/refund/route');
    const res = await route.POST(makeRequest({ reason: 'duplicate' }), {
      params: Promise.resolve({ id: 'pay1' }),
    } as any);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already_refunded');
  });

  test('writes PaymentEvent with admin.manual_refund event type', async () => {
    mockPaymentFindUnique.mockResolvedValue(PAYMENT);
    mockPaymentUpdate.mockResolvedValue({});
    mockPaymentEventCreate.mockResolvedValue({});
    mockAuditCreate.mockResolvedValue({});

    const route = await import('@/app/api/admin/payments/[id]/refund/route');
    await route.POST(makeRequest({ reason: 'test reason' }), {
      params: Promise.resolve({ id: 'pay1' }),
    } as any);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Transaction contains [paymentUpdate, paymentEventCreate, auditLogCreate]
    const [ops] = mockTransaction.mock.calls[0];
    expect(ops).toHaveLength(3);
  });
});
