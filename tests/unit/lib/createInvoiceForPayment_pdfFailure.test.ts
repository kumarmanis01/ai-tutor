/**
 * FILE OBJECTIVE:
 * - Ensure `createInvoiceForPayment` tolerates PDF generation failures:
 *   it should return an `invoiceNumber`, leave `pdfBuffer` undefined,
 *   and NOT call the R2 upload path.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/createInvoiceForPayment_pdfFailure.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add test for PDF generation failure path
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('createInvoiceForPayment — PDF failure handling', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns invoiceNumber and skips R2 upload when generateInvoicePdf throws', async () => {
    const uploadMock = jest.fn();
    const invoiceUpdateMock = jest.fn();

    const prismaMock: any = {
      $transaction: jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          const tx = {
            invoiceSequence: { upsert: jest.fn(async () => ({ lastNumber: 999 })) },
            invoice: { create: jest.fn(async () => ({ id: 'inv-2' })) },
          };
          return await fn(tx);
        }
        return Promise.all(fn);
      }),
      invoice: { update: invoiceUpdateMock },
    };

    // Mock prisma, r2 upload and logger before importing the module
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/storage/r2', () => ({ uploadBufferToR2: uploadMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
    }));

    // Force pdf-lib to fail so generateInvoicePdf throws (fallback path failing)
    jest.doMock('pdf-lib', () => ({
      PDFDocument: {
        create: jest.fn(() => {
          throw new Error('pdf-lib failure');
        }),
      },
      StandardFonts: { Helvetica: {} },
    }));

    const invoices = await import('@/lib/invoices');

    const res = await invoices.createInvoiceForPayment({
      userId: 'u2',
      paymentId: 'pay-2',
      amountPaise: 12345,
    });

    expect(res).toBeDefined();
    expect(res.invoiceNumber).toBe(999);
    expect(res.pdfBuffer).toBeUndefined();
    // When PDF generation fails, upload should not be attempted and DB not updated
    expect(uploadMock).not.toHaveBeenCalled();
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });
});
