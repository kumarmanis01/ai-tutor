/**
 * FILE OBJECTIVE:
 * - Integration-style test for `createInvoiceForPayment` to ensure PDF
 *   generation, R2 upload, and invoice DB update happen end-to-end with
 *   R2/mailer mocked.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/createInvoiceForPayment.test.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('createInvoiceForPayment integration', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('generates PDF, uploads to R2 and updates invoice record', async () => {
    const uploadMock = jest.fn(async (buffer: Buffer, key: string, contentType: string) => `https://r2.test/${key}`)
    const invoiceUpdateMock = jest.fn(async () => ({}))

    const prismaMock: any = {
      $transaction: jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          const tx = {
            invoiceSequence: { upsert: jest.fn(async () => ({ lastNumber: 456 })) },
            invoice: { create: jest.fn(async () => ({ id: 'inv-1' })) },
          }
          return await fn(tx)
        }
        return Promise.all(fn)
      }),
      invoice: { update: invoiceUpdateMock },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/storage/r2', () => ({ uploadBufferToR2: uploadMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }))

    const invoices = await import('@/lib/invoices')

    const res = await invoices.createInvoiceForPayment({ userId: 'u1', paymentId: 'pay-1', amountPaise: 99900 })

    expect(res).toBeDefined()
    expect(res.invoiceNumber).toBe(456)
    expect(Buffer.isBuffer(res.pdfBuffer)).toBe(true)
    // uploadBufferToR2 should have been called and prisma.invoice.update should have been called with fileUrl
    expect(uploadMock).toHaveBeenCalled()
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({ where: { invoiceNumber: 456 }, data: { fileUrl: expect.stringContaining('invoices/invoice-456.pdf') } })
  })
})
