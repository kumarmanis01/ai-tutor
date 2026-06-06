/**
 * FILE OBJECTIVE:
 * - GET /api/student/progress/narrative
 * - Returns a 2-3 sentence GPT-4o-mini generated narrative insight for the
 *   student's last 30 days of learning (section 1 of the progress report page).
 * - Auth-guarded: 401 before any DB query.
 * - Always returns { narrative: string } -- never exposes raw errors to client.
 *
 * Cache strategy (Option A from PROGRESS_PAGE_GAP_AUDIT.md):
 *   1. Check Redis for `narrative:{userId}` (6 h TTL).
 *   2. Cache HIT  → return cached text immediately.
 *   3. Cache MISS → enqueue BullMQ NARRATIVE job (fire-and-forget, worker writes
 *                   result back to Redis when done). Return FALLBACK_NARRATIVE so
 *                   the UI always receives a valid { narrative } response.
 *   On the student's next visit (typically >1 min later) the cache will be warm
 *   and the personalised AI text will be served.
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 * - 2026-05-09T00:00:00Z | copilot | fix Gap 1 (PROGRESS_PAGE_GAP_AUDIT.md): always
 *     return { narrative } by serving from Redis cache; enqueue refresh job when cold
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { computeReadinessScore } from '@/lib/student/examReadiness';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const FALLBACK_NARRATIVE =
  'Keep going! Your consistent practice is building strong foundations. ' +
  'Every session adds to your knowledge -- you are making real progress.';

/** Redis TTL for a cached narrative (6 hours). */
const NARRATIVE_CACHE_TTL_SECONDS = 6 * 60 * 60;

/** Redis key for a student's latest progress narrative. */
export function narrativeCacheKey(userId: string): string {
  return `narrative:${userId}`;
}

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
  const cacheKey = narrativeCacheKey(userId);

  try {
    // ── 1. Serve from Redis cache when warm ──────────────────────────────────
    try {
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          res = NextResponse.json({ narrative: cached });
          logger.logAPI(req, res, { className: 'ProgressNarrativeAPI', methodName: 'GET' }, start);
          return res;
        }
      }
    } catch (cacheErr) {
      // Non-fatal: proceed to enqueue
      logger.warn('ProgressNarrativeAPI: Redis read failed, proceeding to enqueue', {
        event: 'progress_narrative_cache_miss',
        context: { userId, error: String(cacheErr) },
      });
    }

    // ── 2. Cache cold: gather context and enqueue worker job ─────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [sessionCount, studentProfile] = await Promise.all([
      prisma.structuredSession.count({
        where: { studentId: userId, startedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { subjects: true },
      }),
    ]);

    const subjectNames = [...new Set(
      (studentProfile?.subjects ?? []).map((s: any) => String(s)).filter(Boolean),
    )];

    // Resolve chapter context for the first subject (provides richer narrative)
    let bestChapterName = 'your strongest topic';
    let weakestChapterName = 'your area to focus on';

    if (subjectNames.length > 0) {
      try {
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
      } catch (ctxErr) {
        // Non-fatal: worker will use generic chapter names
        logger.warn('ProgressNarrativeAPI: chapter context lookup failed', {
          event: 'progress_narrative_ctx_error',
          context: { userId, error: String(ctxErr) },
        });
      }
    }

    // Enqueue job -- worker writes result to Redis[cacheKey] when done.
    // Fire-and-forget: do not await the job result here.
    try {
      const { getAIRequestQueue } = await import('@/queues/aiQueue');
      const q = getAIRequestQueue();
      await q.add('AI_NARRATIVE', {
        type: 'NARRATIVE',
        payload: {
          userId,
          sessionCount,
          subjectNames,
          bestChapterName,
          weakestChapterName,
          timeframeDays: 30,
          model: 'gpt-4o-mini',
          // Worker will write the generated text to this Redis key
          cacheKey,
          cacheTtlSeconds: NARRATIVE_CACHE_TTL_SECONDS,
        },
      });
    } catch (enqueueErr) {
      logger.error('ProgressNarrativeAPI: failed to enqueue narrative job', {
        event: 'progress_narrative_enqueue_error',
        context: { userId, error: String(enqueueErr) },
      });
    }

    // ── 3. Always return a valid { narrative } to the widget ─────────────────
    // Cache was cold; return fallback. On next visit the cache will be warm.
    res = NextResponse.json({ narrative: FALLBACK_NARRATIVE });
    logger.logAPI(req, res, { className: 'ProgressNarrativeAPI', methodName: 'GET' }, start);
    return res;

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
