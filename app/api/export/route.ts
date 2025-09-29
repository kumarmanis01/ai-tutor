// app/api/export/route.ts
import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * POST /api/export
 * Body: { title?: string, messages: [{ role, content }], format?: "pdf"|"text" }
 * Returns: application/pdf or text/plain
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title = 'chat_export', messages, format = 'pdf' } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'no_messages' }, { status: 400 });
    }

    if (format === 'text') {
      // Concatenate simple text export
      const textLines = messages.map((m) => `${m.role === 'user' ? 'You' : 'Tutor'}: ${m.content}`);
      const txt = textLines.join('\n\n');
      return new NextResponse(txt, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${title}.txt"`,
        },
      });
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
    console.error('export error:', err);
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 });
  }
}
