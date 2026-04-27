/**
 * FILE OBJECTIVE:
 * - Unit test for parent subscription verify route to validate invoice generation
 *   + email attachment flow (mocks createInvoiceForPayment + mailer).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription-verify.test.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('parent subscription verify route', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('generates invoice and sends receipt email on successful verification', async () => {
    const crypto = await import('crypto')
    process.env.RAZORPAY_KEY_SECRET = 'test-secret'

    // Mock session
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'u1', role: 'parent' } })) }))

    // Mock prisma paymentOrder and user lookup + transactional behavior
    const prismaMock: any = {
      paymentOrder: { findUnique: jest.fn(async () => ({ razorpayOrderId: 'order-1', studentId: 'u1', status: 'created', amount: 99900, planMonths: 1, providerIdempotencyKey: 'pkey' })) },
      user: { findUnique: jest.fn(async () => ({ name: 'Parent', email: 'p@example.test', phone: null })) },
      $transaction: jest.fn(async (fn: any) => {
        return await fn({
          paymentOrder: { update: async () => ({}) },
          payment: { create: async () => ({ id: 'pay-1' }) },
          subscription: { create: async () => ({ id: 'sub-1' }) },
          user: { update: async () => ({}) },
          freeTierUsage: { upsert: async () => ({}) },
          installment: { create: async () => ({}) },
        })
      }),
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    // Mock invoice creation to avoid heavy DB and R2 integration
    const invoiceMock = { createInvoiceForPayment: jest.fn(async () => ({ invoiceNumber: 42, pdfBuffer: Buffer.from('pdf'), fileUrl: 'https://r2/invoice-42.pdf' })) }
    jest.doMock('@/lib/invoices', () => invoiceMock)
    const sendEmailMock = jest.fn(async () => undefined)
    jest.doMock('@/lib/mailer', () => ({ sendEmail: sendEmailMock }))
    jest.doMock('@/lib/sms', () => ({ sendSms: jest.fn(async () => undefined) }))

    const orderId = 'order-1'
    const paymentId = 'pay-1'
    const payload = `${orderId}|${paymentId}`
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(payload).digest('hex')

    const req: any = { json: async () => ({ orderId, paymentId, signature, planId: 'standard_monthly' }) }

    const route = await import('@/app/api/parent/subscription/verify/route')
    const res = await route.POST(req as unknown as Request)

    expect(res).toBeDefined()
    // Expect that invoice creation and email were attempted
    const invoices = await import('@/lib/invoices')
    expect(invoices.createInvoiceForPayment).toHaveBeenCalled()
    const mailer = await import('@/lib/mailer')
    expect(mailer.sendEmail).toHaveBeenCalled()
  })
})
