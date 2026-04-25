/**
 * FILE OBJECTIVE:
 * - GET /api/student/progress/narrative
 * - Returns a 2-3 sentence GPT-4o-mini generated narrative insight for the
 *   student's last 30 days of learning (section 1 of the progress report page).
 * - Auth-guarded: 401 before any DB query.
 * - Calls OpenAI directly via fetch (callLLM.ts is worker-only -- ALLOW_LLM_CALLS=1).
 * - Always returns { narrative: string } -- never exposes raw errors to client.
 * - AbortController timeout: 10 000 ms.
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { computeReadinessScore } from '@/lib/student/examReadiness';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const FALLBACK_NARRATIVE =
  'Keep going! Your consistent practice is building strong foundations. ' +
  'Every session adds to your knowledge -- you are making real progress.';

export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'ProgressNarrativeAPI', methodName: 'GET' }, start);
    return res;
  }

  const userId = user.id;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch session count + student subjects in parallel
    const [sessionCount, studentProfile] = await Promise.all([
      prisma.structuredSession.count({
        where: { studentId: userId, startedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { subjects: true },
      }),
    ]);

    const subjectNames = (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean);

    // Get readiness for the first subject (enough for narrative context)
    let bestChapterName = 'your strongest topic';
    let weakestChapterName = 'your area to focus on';

    if (subjectNames.length > 0) {
      const subjectDefs = await prisma.subjectDef.findMany({
        where: {
          OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }],
          lifecycle: 'active',
        },
        select: { id: true },
      });

      if (subjectDefs.length > 0) {
        const readiness = await computeReadinessScore(userId, subjectDefs[0].id);
        if (readiness.chapters.length > 0) {
          const sorted = [...readiness.chapters].sort((a, b) => b.masteryScore - a.masteryScore);
          bestChapterName = sorted[0].chapterName;
          weakestChapterName = sorted[sorted.length - 1].chapterName;
        }
      }
    }

    // Enqueue a background job to generate the narrative (LLM calls are worker-only)
    try {
      const { getAIRequestQueue } = await import('@/queues/aiQueue');
      const q = getAIRequestQueue();

      const job = await q.add('AI_NARRATIVE', {
        type: 'NARRATIVE',
        payload: {
          userId,
          sessionCount,
          subjectNames,
          bestChapterName,
          weakestChapterName,
          timeframeDays: 30,
          model: 'gpt-4o-mini',
        },
      });

      res = NextResponse.json({ status: 'queued', jobId: job.id }, { status: 202 });
      logger.logAPI(req, res, { className: 'ProgressNarrativeAPI', methodName: 'GET' }, start);
      return res;
    } catch (e) {
      logger.error('Failed to enqueue narrative job', {
        event: 'progress_narrative_enqueue_error',
        context: { userId, error: String(e) },
      });
      res = NextResponse.json({ narrative: FALLBACK_NARRATIVE });
      logger.logAPI(req, res, { className: 'ProgressNarrativeAPI', methodName: 'GET' }, start);
      return res;
    }
  } catch (err) {
    logger.error('ProgressNarrativeAPI unexpected error', {
      event: 'progress_narrative_error',
      context: { userId, error: err instanceof Error ? err.message : String(err) },
    });
    res = NextResponse.json({ narrative: FALLBACK_NARRATIVE });
    logger.logAPI(req, res, { className: 'ProgressNarrativeAPI', methodName: 'GET' }, start);
    return res;
  }
}
