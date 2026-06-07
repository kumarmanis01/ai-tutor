/**
 * GET /api/student/diagnostic/check-ready?subjectId={id}
 *
 * Lightweight readiness check for DiagnosticWaitingScreen polling.
 * Called every 5 s by the client -- no DB writes, three COUNT queries only.
 * All question counts use relation filters (topic -> chapter -> subjectId) so
 * no intermediate ID fetch is required.
 *
 * Response: { ready: boolean, phase: "topics" | "questions" | "ready" }
 *   phase "topics"    -- syllabus pipeline has not completed (no TopicDef rows)
 *   phase "questions" -- topics exist but question bank is still empty
 *   phase "ready"     -- both present; client should navigate to the diagnostic
 *
 * Auth: session required -- 401 if missing.
 * See: docs/v2/on-demand-generator.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

// Production telemetry (2026-06-07): this endpoint was responsible for ~1.7M
// COUNT(Question) calls and ~141K COUNT(TopicDef) calls -- a 5s client poll
// keeps adding up. Cache the "ready" result for 8s in Redis (just longer than
// the poll interval) so once any caller sees ready=true, the next ~1-2 polls
// for the same subject short-circuit at the cache.
const CACHE_TTL_SECONDS = 8;
const NEGATIVE_CACHE_TTL_SECONDS = 4;

interface ReadyResponse {
  ready: boolean;
  phase: 'topics' | 'questions' | 'ready';
}

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use req.url (always present) rather than req.nextUrl so the handler is
  // testable with a plain Request, not just NextRequest.
  const subjectId = new URL(req.url).searchParams.get('subjectId');
  if (!subjectId || typeof subjectId !== 'string') {
    return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
  }

  // The result depends only on subjectId (per-subject content availability),
  // not on the caller, so the cache is global rather than per-student.
  const cacheKey = `diag:check-ready:${subjectId}`;
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached) as ReadyResponse);
      }
    } catch (err) {
      // Best-effort: cache failure must never block the readiness check.
      logger.warn('[check-ready] cache read failed', {
        event: 'diagnostic.check_ready.cache_read_error',
        context: { studentId: userId, subjectId, error: String(err) },
      });
    }
  }

  try {
    const topicCount = await prisma.topicDef.count({
      where: {
        chapter: { subjectId, lifecycle: 'active' },
        lifecycle: 'active',
      },
    });

    if (topicCount === 0) {
      const payload: ReadyResponse = { ready: false, phase: 'topics' };
      void cacheSet(redis, cacheKey, payload, NEGATIVE_CACHE_TTL_SECONDS);
      return NextResponse.json(payload);
    }

    // Use relation filters in both count queries to avoid a separate findMany
    // for topic IDs -- three COUNT queries total, no intermediate data fetch.
    const qCount = await prisma.question.count({
      where: {
        status: 'ACTIVE',
        topic: { lifecycle: 'active', chapter: { lifecycle: 'active', subjectId } },
      },
    });

    if (qCount > 0) {
      const payload: ReadyResponse = { ready: true, phase: 'ready' };
      void cacheSet(redis, cacheKey, payload, CACHE_TTL_SECONDS);
      return NextResponse.json(payload);
    }

    const gqCount = await prisma.generatedQuestion.count({
      where: {
        test: {
          lifecycle: 'active',
          topic: { lifecycle: 'active', chapter: { lifecycle: 'active', subjectId } },
        },
      },
    });

    if (gqCount > 0) {
      const payload: ReadyResponse = { ready: true, phase: 'ready' };
      void cacheSet(redis, cacheKey, payload, CACHE_TTL_SECONDS);
      return NextResponse.json(payload);
    }

    const payload: ReadyResponse = { ready: false, phase: 'questions' };
    void cacheSet(redis, cacheKey, payload, NEGATIVE_CACHE_TTL_SECONDS);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error('[check-ready] readiness check failed', {
      event: 'diagnostic.check_ready.error',
      context: { studentId: userId, subjectId, error: String(err) },
    });
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}

async function cacheSet(
  redis: ReturnType<typeof getRedis>,
  key: string,
  payload: ReadyResponse,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
  } catch {
    // Swallow: caching is non-essential to correctness.
  }
}
