import { PDFDocument, StandardFonts } from 'pdf-lib';
import { uploadBufferToR2 } from '@/lib/storage/r2';

export interface InvoiceCreateOpts {
  userId: string;
  paymentId?: string;
  studentId?: string;
  amountPaise: number;
  planLabel?: string;
  billingCycle?: string;
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
  gstin?: string;
  hsn?: string;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 approx
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { invoiceNumber, userName, studentName, amountPaise, gstin, hsn } = options;
  const totalRupees = (options.totalRupees ?? Math.round(amountPaise / 10000) / 100) || Math.round(amountPaise / 100) / 100;
  let y = 800;
  const write = (text: string, size = 12) => {
    page.drawText(text, { x: 40, y, size, font: helvetica });
    y -= size + 8;
  };

  write(`Spinzy Academy` , 18);
  write(`GST Invoice #${invoiceNumber}`, 14);
  write(`Date: ${options.date ?? new Date().toLocaleDateString('en-IN')}`, 12);
  y -= 6;
  write(`Bill To: ${userName ?? 'Parent'}`);
  if (studentName) write(`Student: ${studentName}`);
  y -= 6;
  write(``);
  write(`Description: ${options.billingCycle ?? 'Subscription'}`);
  write(`Amount (INR): ${(amountPaise / 100).toFixed(2)}`);
  if (typeof options.baseRupees !== 'undefined') write(`Base (INR): ${options.baseRupees}`);
  if (typeof options.gstRupees !== 'undefined') write(`GST (INR): ${options.gstRupees}`);
  write(`Total (INR): ${(amountPaise / 100).toFixed(2)}`);
  if (hsn) write(`HSN: ${hsn}`);
  if (gstin) write(`Platform GSTIN: ${gstin}`);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Create invoice DB record, generate PDF buffer and upload to R2.
 * Returns { invoice, pdfBuffer, fileUrl? }
 */
export async function createInvoiceForPayment(opts: InvoiceCreateOpts) {
  // Import prisma lazily to avoid pulling the client into tests that only need PDF generation
  const { prisma } = await import('@/lib/prisma');

  // Allocate invoice number using a single-row sequence upsert
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
      },
    });
    return { invoiceNumber: seq.lastNumber, invoiceId: invoice.id };
  });

  const invoiceNumber = trxResult.invoiceNumber;

  // Build PDF
  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber,
    userName: undefined,
    studentName: undefined,
    amountPaise: opts.amountPaise,
    billingCycle: opts.billingCycle,
    date: new Date().toLocaleDateString('en-IN'),
    gstin: process.env.PLATFORM_GSTIN,
    hsn: process.env.PLATFORM_HSN,
  });

  // Upload to R2 (best effort)
  const key = `invoices/invoice-${invoiceNumber}.pdf`;
  let fileUrl: string | undefined = undefined;
  try {
    fileUrl = await uploadBufferToR2(pdfBuffer, key, 'application/pdf');
    await prisma.invoice.update({ where: { invoiceNumber }, data: { fileUrl } });
  } catch (err) {
    console.error('[invoices] failed to upload invoice to R2', err);
  }

  return { invoiceNumber, pdfBuffer, fileUrl };
}

export default { generateInvoicePdf, createInvoiceForPayment };
