import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

// Parses a chapter PDF to metadata entries (titles, tags) without storing textbook content.
export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role || 'user';
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  const file = form.get('pdf');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'no_pdf' }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    // Attempt to use pdf-parse if available
    let text = '';
    try {
      const pdfParse = (await import('pdf-parse')).default as any;
      const data = await pdfParse(buf);
    text = String(data.text || '');
    } catch (e) {
    logger.warn('pdf-parse not available or failed; falling back to naive text extraction');
    logger.error('pdf-parse error:', e as any);
    // Fallback: naive binary-to-string; results may be poor without pdf-parse
    text = buf.toString('latin1');
    }

    // Extract headings heuristically: lines with Title Case or numbered headings
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const headingLike = lines.filter((l) => /^(chapter\s*\d+|[A-Z][A-Za-z0-9 ,:-]{5,})$/.test(l.replace(/\s+/g, ' '))); 

    // Build hierarchical taxonomy structure (Board > Class > Subject > Chapter > Topic)
    // For demo, assume headings are chapters/topics under a single subject/grade/board
    const board = 'CBSE';
    const grade = '6'; // eslint-disable-line @typescript-eslint/no-unused-vars
    const subject = 'Mathematics';
    const language = 'en';
    const chapters = headingLike.slice(0, 50).map((h, idx) => {
      const slug = h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return {
        id: `chapter-${slug}`,
        name: h,
        slug,
        order: idx + 1,
        topics: [], // You can enhance this to extract topics if available
      };
    });
    const taxonomy = {
      board: { id: 'cbse', name: board, slug: 'cbse' },
      class: { id: 'class-6', name: 'Class 6', slug: 'class-6', board_id: 'cbse' },
      subject: { id: 'math', name: subject, slug: 'mathematics', class_id: 'class-6' },
      chapters,
      language,
    };
    // Print taxonomy JSON to the dev logger for inspection
    logger.info('[PARSE-PDF TAXONOMY] ' + JSON.stringify(taxonomy, null, 2));
    return NextResponse.json({ ok: true, message: 'Taxonomy logged to server logger.' });
  } catch (e: any) {
    return NextResponse.json({ error: 'parse_failed', message: String(e?.message || e) }, { status: 500 });
  }
}
