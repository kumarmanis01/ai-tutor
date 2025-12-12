import { logger } from '@/lib/logger';
// app/api/export/route.ts
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * POST /api/export
 * Body: { title?: string, messages: [{ role, content }], format?: "pdf"|"text" }
 * Returns: application/pdf or text/plain
 */
export async function POST(req: Request) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    let res: Response;
    if (!session?.user?.id) {
      res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'ExportAPI', methodName: 'POST' }, start);
      return res;
    }
    const body = await req.json();
    const { title = 'chat_export', messages, format = 'pdf' } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res = NextResponse.json({ error: 'no_messages' }, { status: 400 });
      logger.logAPI(req, res, { className: 'ExportAPI', methodName: 'POST' }, start);
      return res;
    }

    if (format === 'text') {
      // Concatenate simple text export
      const textLines = messages.map((m) => `${m.role === 'user' ? 'You' : 'Tutor'}: ${m.content}`);
      const txt = textLines.join('\n\n');
      res = new NextResponse(txt, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${title}.txt"`,
        },
      });
      logger.logAPI(req, res, { className: 'ExportAPI', methodName: 'POST' }, start);
      return res;
    }

    // PDF generation using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4-ish
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    const margin = 40;
    let y = page.getHeight() - margin;

    // Title
    page.drawText(title, { x: margin, y, size: 16, font });
    y -= 26;

    const maxChars = 90; // rough wrap
    for (const m of messages) {
      const label = m.role === 'user' ? 'You: ' : 'AI: ';
      const text = label + (m.content ?? '');
      // naive wrap
      let remainder = text;
      while (remainder.length > 0) {
        const line = remainder.slice(0, maxChars);
        if (y < margin + 20) {
          // new page
          const newPage = pdfDoc.addPage([595, 842]);
          y = newPage.getHeight() - margin;
          newPage.drawText(line, { x: margin, y, size: fontSize, font });
        } else {
          page.drawText(line, { x: margin, y, size: fontSize, font });
        }
        remainder = remainder.slice(maxChars);
        y -= fontSize + 6;
      }
      y -= 8;
    }

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title}.pdf"`,
      },
    });
  } catch (err) {
    logger.error('export error', { className: 'api.export', methodName: 'GET', error: String(err) });
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 });
  }
}
