import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mock/[examId]/export
 * Returns a PDF file containing questions only (no answers) for offline practice.
 * Auth-guarded: 401 before any DB query.
 */
export async function GET(req: Request, { params }: { params: { examId: string } }) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockExportAPI', methodName: 'GET' }, start);
    return res;
  }

  const { examId } = params;

  const exam = await prisma.mockExam.findUnique({
    where: { id: examId },
    include: {
      subject: { select: { name: true } },
      sections: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          totalMarks: true,
          questions: {
            orderBy: { order: 'asc' },
            select: {
              order: true,
              marks: true,
              question: { select: { prompt: true } },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    const res = NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'MockExportAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    // Build PDF using pdf-lib (simple, paginated, questions only)
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]); // A4-ish
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSizeTitle = 16;
    const fontSize = 11;
    const margin = 40;
    let y = page.getHeight() - margin;

    function addLine(text: string, size = fontSize) {
      // naive wrap
      const maxChars = 90;
      let remainder = text;
      while (remainder.length > 0) {
        const line = remainder.slice(0, maxChars);
        if (y < margin + 20) {
          page = pdfDoc.addPage([595, 842]);
          y = page.getHeight() - margin;
        }
        page.drawText(line, { x: margin, y, size, font });
        remainder = remainder.slice(maxChars);
        y -= size + 6;
      }
      y -= 6;
    }

    // Title
    page.drawText(exam.title ?? 'Mock Exam', { x: margin, y, size: fontSizeTitle, font });
    y -= fontSizeTitle + 8;
    page.drawText(`Subject: ${exam.subject?.name ?? ''}`, { x: margin, y, size: 11, font });
    y -= 18;

    let qNo = 1;
    for (const sec of exam.sections ?? []) {
      if (y < margin + 80) {
        page = pdfDoc.addPage([595, 842]);
        y = page.getHeight() - margin;
      }
      page.drawText(`${sec.title}`, { x: margin, y, size: 13, font });
      y -= 18;

      for (const q of sec.questions ?? []) {
        const line = `Q${qNo}. (${q.marks} mark${q.marks > 1 ? 's' : ''}) ${q.question.prompt}`;
        addLine(line);
        qNo += 1;
        // ensure we don't overflow page
        if (y < margin + 40) {
          page = pdfDoc.addPage([595, 842]);
          y = page.getHeight() - margin;
        }
      }

      y -= 6;
    }

    const pdfBytes = await pdfDoc.save();

    // Rate-limit exports per user (best-effort)
    try {
      const { allowRequest } = await import('@/lib/rateLimit');
      const key = `mock_export:${session.user.id}`;
      if (!allowRequest(key, 5, 60_000)) {
        const res = NextResponse.json({ error: 'rate_limited' }, { status: 429 });
        logger.logAPI(req, res, { className: 'MockExportAPI', methodName: 'GET' }, start);
        return res;
      }
    } catch {
      // swallow; non-critical
    }

    // Audit non-blocking
    try {
      const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma;
      const { logAuditEvent } = await import('@/lib/audit/log');
      logAuditEvent(db, {
        actorId: session.user.id,
        action: 'export_mock_pdf',
        entityType: 'MOCK_EXAM',
        entityId: exam.id,
        metadata: { title: exam.title },
      });
    } catch {}

    const filename = `${(exam.title ?? 'mock').replace(/[^a-z0-9-_]/gi, '_')}.pdf`;
    const res = new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
    logger.logAPI(req, res, { className: 'MockExportAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('mock.export.failed', { error: String(err) });
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'MockExportAPI', methodName: 'GET' }, start);
    return res;
  }
}
