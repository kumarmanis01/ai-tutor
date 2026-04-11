import { generateInvoicePdf } from '@/lib/invoices';

describe('generateInvoicePdf', () => {
  it('creates a non-empty PDF buffer with PDF header', async () => {
    const buf = await generateInvoicePdf({
      invoiceNumber: 123,
      userName: 'Test Parent',
      studentName: 'Riya',
      amountPaise: 105138, // ₹1051.38
      baseRupees: 891,
      gstRupees: 160.38,
      totalRupees: 1051.38,
      billingCycle: 'Annual',
      date: '01 April 2026',
    });
    expect(buf).toBeInstanceOf(Buffer);
    const s = buf.toString('utf8', 0, Math.min(20, buf.length));
    expect(s).toContain('%PDF');
  });
});
