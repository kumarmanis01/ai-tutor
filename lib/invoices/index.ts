import { PDFDocument, StandardFonts } from 'pdf-lib';
import { uploadBufferToR2 } from '@/lib/storage/r2';
import { logger } from '@/lib/logger';

export interface InvoiceCreateOpts {
  userId: string;
  paymentId?: string;
  studentId?: string;
  amountPaise: number;
  planLabel?: string;
  billingCycle?: string;
}

function rupees(n: number) {
  return n.toFixed(2);
}

function invoiceHtml(opts: {
  invoiceNumber: number;
  userName?: string;
  studentName?: string;
  baseRupees: number;
  gstRupees: number;
  totalRupees: number;
  billingCycle?: string;
  date?: string;
  gstin?: string | null;
  hsn?: string | null;
  taxBreakdown?: any;
}) {
  const { invoiceNumber, userName, studentName, baseRupees, gstRupees, totalRupees, billingCycle } = opts;
  const gstDisplay = rupees(gstRupees);
  const baseDisplay = rupees(baseRupees);
  const totalDisplay = rupees(totalRupees);
  const gstin = opts.gstin ?? '';
  const hsn = opts.hsn ?? '';
  const date = opts.date ?? new Date().toLocaleDateString('en-IN');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111; }
        .wrap { max-width:720px; margin:24px auto; padding:16px; }
        .brand { color:#534AB7; font-size:20px; font-weight:700; }
        table { width:100%; border-collapse:collapse; margin-top:12px }
        td, th { padding:8px; vertical-align:top; }
        .right { text-align:right }
        .muted { color:#666; font-size:13px }
        .total { font-weight:700; font-size:16px }
        .small { font-size:12px }
        .border { border-top:1px solid #eee }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="brand">Spinzy Academy</div>
        <div class="muted">GST Invoice #${invoiceNumber} · Date: ${date}</div>

        <table>
          <tr>
            <td>
              <div><strong>Bill To</strong></div>
              <div>${userName ?? 'Parent'}</div>
              ${studentName ? `<div class="small muted">Student: ${studentName}</div>` : ''}
            </td>
            <td class="right">
              <div class="small">HSN: ${hsn}</div>
              <div class="small">Platform GSTIN: ${gstin}</div>
            </td>
          </tr>
        </table>

        <table style="margin-top:18px;">
          <tr class="border">
            <td>Description</td>
            <td class="right">Amount (INR)</td>
          </tr>
          <tr>
            <td>${billingCycle ?? 'Subscription'}</td>
            <td class="right">₹${baseDisplay}</td>
          </tr>
          <tr>
            <td class="muted small">GST</td>
            <td class="right">₹${gstDisplay}</td>
          </tr>
          <tr class="border">
            <td class="total">Total</td>
            <td class="right total">₹${totalDisplay}</td>
          </tr>
        </table>

        ${opts.taxBreakdown ? `<div class="small muted" style="margin-top:12px;">Tax breakdown: ${JSON.stringify(opts.taxBreakdown)}</div>` : ''}

        <div style="margin-top:24px;" class="muted small">This is a system-generated invoice.</div>
      </div>
    </body>
  </html>
  `;
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  try {
    // In test environments, avoid launching Playwright (browsers may not be installed)
    // and force the caller to use the pdf-lib fallback quickly.
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      throw new Error('Playwright disabled in test environment')
    }
    // Dynamic import so Playwright is optional; fallback will be used when unavailable
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pw = await import('playwright');
    const browser = await pw.chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdf);
  } catch (err) {
    // Playwright not available or failed; let caller fallback
    throw err;
  }
}

export async function generateInvoicePdf(options: {
  invoiceNumber: number;
  userName?: string;
  studentName?: string;
  amountPaise: number;
  baseRupees?: number;
  gstRupees?: number;
  totalRupees?: number;
  billingCycle?: string;
  date?: string;
  gstin?: string | null;
  hsn?: string | null;
  taxBreakdown?: any;
}): Promise<Buffer> {
  // First try HTML -> PDF using Playwright if available (better layout and fonts)
  const totalRupees = options.totalRupees ?? Math.round(options.amountPaise) / 100;
  const baseRupees = options.baseRupees ?? Math.round((totalRupees / 1.18) * 100) / 100;
  const gstRupees = options.gstRupees ?? Math.round((totalRupees - baseRupees) * 100) / 100;
  const html = invoiceHtml({
    invoiceNumber: options.invoiceNumber,
    userName: options.userName,
    studentName: options.studentName,
    baseRupees,
    gstRupees,
    totalRupees,
    billingCycle: options.billingCycle,
    date: options.date,
    gstin: options.gstin ?? null,
    hsn: options.hsn ?? null,
    taxBreakdown: options.taxBreakdown,
  });

  try {
    const buf = await renderHtmlToPdf(html);
    return buf;
  } catch (_err) {
    // Playwright render failed — log and fallback to simple pdf-lib text renderer when Playwright is not available
    logger.warn('[invoices] Playwright render failed, falling back to pdf-lib', { error: String(_err) });
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 approx
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { invoiceNumber, userName, studentName } = options;
    let y = 800;
    const write = (text: string, size = 12) => {
      page.drawText(text, { x: 40, y, size, font: helvetica });
      y -= size + 8;
    };

    write(`Spinzy Academy`, 18);
    write(`GST Invoice #${invoiceNumber}`, 14);
    write(`Date: ${options.date ?? new Date().toLocaleDateString('en-IN')}`, 12);
    y -= 6;
    write(`Bill To: ${userName ?? 'Parent'}`);
    if (studentName) write(`Student: ${studentName}`);
    y -= 6;
    write(``);
    write(`Description: ${options.billingCycle ?? 'Subscription'}`);
    write(`Amount (INR): ${rupees(totalRupees)}`);
    if (typeof options.baseRupees !== 'undefined') write(`Base (INR): ${rupees(options.baseRupees as number)}`);
    if (typeof options.gstRupees !== 'undefined') write(`GST (INR): ${rupees(options.gstRupees as number)}`);
    write(`Total (INR): ${rupees(totalRupees)}`);
    if (options.hsn) write(`HSN: ${options.hsn}`);
    if (options.gstin) write(`Platform GSTIN: ${options.gstin}`);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

/**
 * Create invoice DB record, generate PDF buffer and upload to R2.
 * Returns { invoiceNumber, pdfBuffer, fileUrl? }
 */
export async function createInvoiceForPayment(opts: InvoiceCreateOpts) {
  // Import prisma lazily to avoid pulling the client into tests that only need PDF generation
  const { prisma } = await import('@/lib/prisma');

  const totalRupees = Math.round(opts.amountPaise) / 100;
  const GST_RATE = parseFloat(process.env.PLATFORM_GST_RATE ?? '0.18');
  const baseRupees = Math.round((totalRupees / (1 + GST_RATE)) * 100) / 100;
  const gstRupees = Math.round((totalRupees - baseRupees) * 100) / 100;
  const cgst = Math.round((gstRupees / 2) * 100) / 100;
  const sgst = Math.round((gstRupees - cgst) * 100) / 100;
  const taxBreakdown = { rate: GST_RATE, cgst, sgst, gst: gstRupees, base: baseRupees };
  const hsn = process.env.PLATFORM_HSN ?? null;
  const gstin = process.env.PLATFORM_GSTIN ?? null;

  // Allocate invoice number using a single-row sequence upsert and create invoice record
  const trxResult = await prisma.$transaction(async (tx) => {
    const seq = await tx.invoiceSequence.upsert({
      where: { id: 'default' },
      update: { lastNumber: { increment: 1 } as any },
      create: { id: 'default', lastNumber: 1 },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: seq.lastNumber,
        userId: opts.userId,
        paymentId: opts.paymentId,
        studentId: opts.studentId,
        amount: opts.amountPaise,
        currency: 'INR',
        hsnCode: hsn,
        gstin: gstin ?? undefined,
        taxBreakdown: taxBreakdown,
      },
    });
    return { invoiceNumber: seq.lastNumber, invoiceId: invoice.id };
  });

  const invoiceNumber = trxResult.invoiceNumber;

  // Build PDF (try HTML render first, fallback to text)
  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber,
    userName: undefined,
    studentName: undefined,
    amountPaise: opts.amountPaise,
    baseRupees,
    gstRupees,
    totalRupees,
    billingCycle: opts.billingCycle,
    date: new Date().toLocaleDateString('en-IN'),
    gstin,
    hsn,
    taxBreakdown,
  });

  // Upload to R2 (best effort)
  const key = `invoices/invoice-${invoiceNumber}.pdf`;
  let fileUrl: string | undefined = undefined;
  try {
    fileUrl = await uploadBufferToR2(pdfBuffer, key, 'application/pdf');
    await prisma.invoice.update({ where: { invoiceNumber }, data: { fileUrl } });
  } catch (err) {
    logger.error('[invoices] failed to upload invoice to R2', { error: err });
  }

  return { invoiceNumber, pdfBuffer, fileUrl };
}

const Invoices = { generateInvoicePdf, createInvoiceForPayment };
export default Invoices;
