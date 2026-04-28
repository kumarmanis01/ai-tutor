/**
 * GET /api/student/tests/trend
 *
 * Returns the last 10 completed chapter practice test scores for the authenticated
 * student, sorted oldest-first so a line chart renders left-to-right improvement.
 *
 * Query params (both optional):
 *   ?chapter=<name>   -- narrow to a specific chapter
 *   ?subject=<name>   -- narrow to a specific subject
 *
 * When neither param is supplied, all chapter tests (any question with a non-null
 * chapter) are included.
 *
 * Response: { data: Array<{ date: string; score: number }> }
 *   date  -- ISO 8601 string (finishedAt)
 *   score -- integer 0-100
 *
 * F-STU-020 AC-07.
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
    logger.logAPI(req, res, { className: 'TestsTrendAPI', methodName: 'GET' }, start);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const chapter = searchParams.get('chapter')?.trim() ?? '';
  const subject = searchParams.get('subject')?.trim() ?? '';

  try {
    // Build the question filter depending on which params were supplied.
    // When both chapter+subject are provided, scope tightly.
    // When neither is provided, include any test that has at least one question
    // with a non-null chapter (i.e. a chapter practice test, not quick-practice).
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

    const rows = await prisma.testResult.findMany({
      where: {
        studentId: userId,
        score: { not: null },
        finishedAt: { not: null },
        AttemptQuestions: { some: questionFilter },
      },
      select: { score: true, finishedAt: true },
      orderBy: { finishedAt: 'asc' },
      take: 10,
    });

    const data = rows.map((r) => ({
      date: r.finishedAt!.toISOString(),
      score: Math.round(r.score!),
    }));

    res = NextResponse.json({ data });
    logger.logAPI(req, res, { className: 'TestsTrendAPI', methodName: 'GET' }, start);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('TestsTrendAPI GET error', { error: message });
    res = NextResponse.json(
      { error: 'Could not load trend data. Please try again.' },
      { status: 500 }
    );
    logger.logAPI(req, res, { className: 'TestsTrendAPI', methodName: 'GET' }, start);
    return res;
  }
}
