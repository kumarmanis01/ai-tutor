/**
 * POST /api/student/diagnostic/save-partial
 *
 * Saves the student's partial diagnostic progress to Redis (24h TTL).
 * Used when the student taps "Save and continue later".
 *
 * Body: {
 *   subjectId: string,
 *   answers: Array<{ questionId: string, selectedOption: string }>,
 *   currentIndex: number
 * }
 *
 * Returns: { saved: true }
 * Auth: session required -- 401 if missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { savePartialDiagnostic } from '@/lib/redis/diagnosticPartial';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'DiagnosticSavePartialAPI', methodName: 'POST' }, start);
      return res;
    }

    const body = await req.json().catch(() => ({}));
    const subjectId: string = typeof body.subjectId === 'string' ? body.subjectId : '';
    const rawAnswers: unknown[] = Array.isArray(body.answers) ? body.answers : [];
    const currentIndex: number =
      typeof body.currentIndex === 'number' && body.currentIndex >= 0
        ? Math.floor(body.currentIndex)
        : 0;

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    }

    const answers = rawAnswers
      .filter(
        (a): a is Record<string, unknown> =>
          !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).questionId === 'string',
      )
      .map((a) => ({
        questionId: String(a.questionId),
        selectedOption: String((a as Record<string, unknown>).selectedOption ?? ''),
      }));

    await savePartialDiagnostic(userId, subjectId, { answers, currentIndex });

    const res = NextResponse.json({ saved: true });
    logger.logAPI(req, res, { className: 'DiagnosticSavePartialAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('DiagnosticSavePartialAPI error', {
      className: 'DiagnosticSavePartialAPI',
      methodName: 'POST',
      error: err,
    });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
