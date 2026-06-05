/**
 * GET /api/student/tests/trends
 *
 * Returns trend arrays for multiple chapters in a single request.
 * Query params:
 *   ?chapter=<name>   (repeatable)
 *   ?subject=<name>   (optional)
 *   ?limit=<n>        (per-chapter limit, default 10)
 *
 * Response: { data: { [chapterName]: Array<{ date, score }> } }
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
    logger.logAPI(req, res, { className: 'TestsTrendsAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const { searchParams } = new URL(req.url);
    const chapters = searchParams.getAll('chapter').map((s) => s.trim()).filter(Boolean);
    if (chapters.length === 0) {
      res = NextResponse.json({ error: 'Missing chapter param' }, { status: 400 });
      logger.logAPI(req, res, { className: 'TestsTrendsAPI', methodName: 'GET' }, start);
      return res;
    }
    const subject = searchParams.get('subject')?.trim() ?? '';
    const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10);
    const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit));

    const promises = chapters.map(async (chap) => {
      const questionFilter = subject
        ? {
            question: {
              chapter: { equals: chap, mode: 'insensitive' as const },
              subject: { equals: subject, mode: 'insensitive' as const },
            },
          }
        : { question: { chapter: { equals: chap, mode: 'insensitive' as const } } };

      const rows = await prisma.testResult.findMany({
        where: {
          studentId: userId,
          score: { not: null },
          finishedAt: { not: null },
          AttemptQuestions: { some: questionFilter },
        },
        select: { score: true, finishedAt: true },
        orderBy: { finishedAt: 'desc' },
        take: limit,
      });

      const points = rows
        .reverse()
        .map((r: any) => ({ date: r.finishedAt!.toISOString(), score: Math.round(r.score!) }));
      return { chapter: chap, data: points };
    });

    const results = await Promise.all(promises);
    const data: Record<string, { date: string; score: number }[]> = {};
    results.forEach((r) => (data[r.chapter] = r.data));

    res = NextResponse.json({ data });
    logger.logAPI(req, res, { className: 'TestsTrendsAPI', methodName: 'GET' }, start);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('TestsTrendsAPI GET error', { error: message });
    res = NextResponse.json({ error: 'Could not load trends' }, { status: 500 });
    logger.logAPI(req, res, { className: 'TestsTrendsAPI', methodName: 'GET' }, start);
    return res;
  }
}
