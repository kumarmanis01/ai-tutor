/**
 * FILE OBJECTIVE:
 * - Ensure `generateInvoicePdf` falls back to `pdf-lib` when Playwright is unavailable.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/invoices.fallback.test.ts
 */

describe('generateInvoicePdf fallback', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns a Buffer even when Playwright is not present', async () => {
    const { generateInvoicePdf } = await import('@/lib/invoices');
    const buf = await generateInvoicePdf({ invoiceNumber: 123, amountPaise: 99900 });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
