/**
 * GET /api/student/tests/history
 *
 * Returns paginated history of chapter practice test results for the
 * authenticated student. Supports `chapter`, `subject`, `limit`, `offset`.
 *
 * Response: { data: Array<{ date: string; score: number }>, totalCount, limit, offset }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const userId = (authSession as { user?: { id?: string } } | null)?.user?.id;
  if (!userId) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'TestsHistoryAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const { searchParams } = new URL(req.url);
    const chapter = searchParams.get('chapter')?.trim() ?? '';
    const subject = searchParams.get('subject')?.trim() ?? '';
    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10);
    const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);

    const questionFilter =
      chapter && subject
        ? {
            question: {
              chapter: { equals: chapter, mode: 'insensitive' as const },
              subject: { equals: subject, mode: 'insensitive' as const },
            },
          }
        : chapter
          ? { question: { chapter: { equals: chapter, mode: 'insensitive' as const } } }
          : subject
            ? { question: { subject: { equals: subject, mode: 'insensitive' as const } } }
            : { question: { chapter: { not: null } } };

    const [totalCount, rows] = await Promise.all([
      prisma.testResult.count({
        where: {
          studentId: userId,
          score: { not: null },
          finishedAt: { not: null },
          AttemptQuestions: { some: questionFilter },
        },
      }),
      prisma.testResult.findMany({
        where: {
          studentId: userId,
          score: { not: null },
          finishedAt: { not: null },
          AttemptQuestions: { some: questionFilter },
        },
        select: { score: true, finishedAt: true },
        orderBy: { finishedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const data = rows.map((r) => ({
      date: r.finishedAt!.toISOString(),
      score: Math.round(r.score!),
    }));

    res = NextResponse.json({ data, totalCount, limit, offset });
    logger.logAPI(req, res, { className: 'TestsHistoryAPI', methodName: 'GET' }, start);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('TestsHistoryAPI GET error', { error: message });
    res = NextResponse.json({ error: 'Could not load history' }, { status: 500 });
    logger.logAPI(req, res, { className: 'TestsHistoryAPI', methodName: 'GET' }, start);
    return res;
  }
}
