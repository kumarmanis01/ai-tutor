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
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns invoiceNumber without pdfBuffer and skips R2 upload when PDF generation fails', async () => {
    const uploadMock = jest.fn();
    const invoiceUpdateMock = jest.fn(async () => ({}));

    const prismaMock: any = {
      $transaction: jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          const tx = {
            invoiceSequence: { upsert: jest.fn(async () => ({ lastNumber: 789 })) },
            invoice: { create: jest.fn(async () => ({ id: 'inv-2' })) },
          };
          return await fn(tx);
        }
        return Promise.all(fn);
      }),
      invoice: { update: invoiceUpdateMock },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/storage/r2', () => ({ uploadBufferToR2: uploadMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
    }));
    // Make pdf-lib throw so the pdf-lib fallback also fails after Playwright is skipped in test env
    jest.doMock('pdf-lib', () => ({
      PDFDocument: { create: jest.fn().mockRejectedValue(new Error('pdf-lib unavailable')) },
      StandardFonts: { Helvetica: 'Helvetica' },
    }));

    const invoices = await import('@/lib/invoices');

    const res = await invoices.createInvoiceForPayment({
      userId: 'u1',
      paymentId: 'pay-2',
      amountPaise: 99900,
    });

    // Invoice record must still be created even when PDF generation fails
    expect(res.invoiceNumber).toBe(789);
    expect(res.pdfBuffer).toBeUndefined();
    expect(res.fileUrl).toBeUndefined();
    // R2 upload must NOT be attempted when there is no PDF buffer
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('generates PDF, uploads to R2 and updates invoice record', async () => {
    const uploadMock = jest.fn(
      async (buffer: Buffer, key: string, contentType: string) => `https://r2.test/${key}`
    );
    const invoiceUpdateMock = jest.fn(async () => ({}));

    const prismaMock: any = {
      $transaction: jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          const tx = {
            invoiceSequence: { upsert: jest.fn(async () => ({ lastNumber: 456 })) },
            invoice: { create: jest.fn(async () => ({ id: 'inv-1' })) },
          };
          return await fn(tx);
        }
        return Promise.all(fn);
      }),
      invoice: { update: invoiceUpdateMock },
    };

    // Return a minimal valid PDF Buffer so the test is independent of whether
    // pdf-lib can generate real PDFs in the CI/test environment (no browser).
    const fakePdfBuffer = Buffer.from('%PDF-1.4 fake');
    jest.doMock('pdf-lib', () => ({
      PDFDocument: {
        create: jest.fn().mockResolvedValue({
          addPage: jest.fn().mockReturnValue({ drawText: jest.fn() }),
          embedFont: jest.fn().mockResolvedValue({ name: 'Helvetica' }),
          save: jest.fn().mockResolvedValue(fakePdfBuffer),
        }),
      },
      StandardFonts: { Helvetica: 'Helvetica' },
    }));

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/storage/r2', () => ({ uploadBufferToR2: uploadMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
    }));

    const invoices = await import('@/lib/invoices');

    const res = await invoices.createInvoiceForPayment({
      userId: 'u1',
      paymentId: 'pay-1',
      amountPaise: 99900,
    });

    expect(res).toBeDefined();
    expect(res.invoiceNumber).toBe(456);
    expect(Buffer.isBuffer(res.pdfBuffer)).toBe(true);
    // uploadBufferToR2 should have been called and prisma.invoice.update should have been called with fileUrl
    expect(uploadMock).toHaveBeenCalled();
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { invoiceNumber: 456 },
      data: { fileUrl: expect.stringContaining('invoices/invoice-456.pdf') },
    });
  });
});
