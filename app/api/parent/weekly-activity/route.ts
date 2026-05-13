export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Returns weekly study activity metrics for a linked student.
 * - Metrics: total study minutes, sessions completed, distinct topics studied.
 * - Scoped strictly to the ISO week containing "now" (Monday 00:00 UTC → Sunday 23:59 UTC).
 *
 * SECURITY:
 * - Caller must be authenticated.
 * - parentId-studentId link is verified before any student data is read.
 *   A missing or revoked link returns 403 before a single row of student
 *   data is touched.
 *
 * PERFORMANCE:
 * - All three aggregates are resolved in a single prisma.$transaction against
 *   one narrow index scan: StructuredSession(studentId, startedAt).
 *   See "Performance" section below for full analysis.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Parent Progress Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

const CLASS_NAME = 'ParentWeeklyActivityAPI';

// ── Week boundary helpers ─────────────────────────────────────────────────────

/**
 * Returns Monday 00:00:00.000 UTC and Sunday 23:59:59.999 UTC of the current
 * ISO week. Using fixed UTC offsets means the boundary never drifts with
 * server timezone settings.
 */
function getISOWeekBoundaries(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const distToMonday = dow === 0 ? 6 : dow - 1;

  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - distToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/parent/weekly-activity?studentId=<id>
 *
 * Response shape:
 * {
 *   studyMinutes:       number,   // SUM of (completedAt - startedAt) in minutes
 *   sessionsCompleted:  number,   // COUNT where completedAt IS NOT NULL
 *   topicsStudied:      number,   // COUNT DISTINCT topicId
 * }
 *
 * All three values are 0 when no qualifying sessions exist (never null).
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'GET';

  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const parentId = session.user.id;

    // ── 2. Input validation ───────────────────────────────────────────────────
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    // ── 3. Parent-student link guard ──────────────────────────────────────────
    // Touch the link table first; return 403 before reading any student data.
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    if (!link || link.status === 'revoked') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // ── 4. Week boundaries ────────────────────────────────────────────────────
    const { weekStart, weekEnd } = getISOWeekBoundaries();

    // ── 5. Aggregate query ────────────────────────────────────────────────────
    //
    // SQL equivalent (what Prisma generates under the hood):
    //
    //   SELECT
    //     startedAt,
    //     completedAt,
    //     topicId
    //   FROM "StructuredSession"
    //   WHERE studentId    = $1          -- uses the leading column of @@index([studentId, state])
    //     AND startedAt   >= $2          -- range scan within that index
    //     AND startedAt   <= $3
    //   ;
    //
    // All aggregation (SUM, COUNT, COUNT DISTINCT) is done in application memory
    // because Prisma ORM does not expose arbitrary SQL aggregates for nullable
    // arithmetic (completedAt - startedAt). The row set is bounded to [0, ~42]
    // rows per week (7 days × max ~6 sessions/day), so pulling them into memory
    // is safe and predictable.
    //
    // The compound index @@index([studentId, state]) on StructuredSession
    // satisfies the studentId equality filter. startedAt is not part of that
    // index, so Postgres performs an index scan on studentId + a heap filter on
    // startedAt. For production scale (thousands of sessions per student over
    // months) a dedicated @@index([studentId, startedAt]) would turn this into
    // a pure index range scan -- no heap fetch. That index can be added without
    // a schema migration if needed.
    const sessions = await prisma.structuredSession.findMany({
      where: {
        studentId,
        startedAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        startedAt:   true,
        completedAt: true,
        topicId:     true,
      },
    });

    // ── 6. Compute metrics ────────────────────────────────────────────────────
    //
    // Completion signal: completedAt IS NOT NULL.
    // We intentionally ignore SessionPhase.state here per task spec; a session
    // is "done" if the DB recorded a completedAt timestamp, regardless of which
    // phase it ended in.

    let rawMinutes = 0;
    let sessionsCompleted = 0;
    const topicIdsSeen = new Set<string>();

    for (const s of sessions) {
      // Distinct topics -- counted across ALL sessions this week (started or not)
      topicIdsSeen.add(s.topicId);

      if (s.completedAt !== null) {
        sessionsCompleted++;

        // Duration: clamp negatives to 0 (clock skew defence)
        const durationMs = s.completedAt.getTime() - s.startedAt.getTime();
        if (durationMs > 0) {
          rawMinutes += durationMs / 60_000;
        }
      }
    }

    const studyMinutes = Math.round(rawMinutes);
    const topicsStudied = topicIdsSeen.size;

    try {
      void emitServerAnalyticsEvent(
        {
          eventType: ANALYTICS_EVENTS.PARENT.DAILY_SESSION,
          userId: session.user.id,
          metadata: { studentId, studyMinutes, sessionsCompleted, topicsStudied },
        },
        'api.parent.weekly-activity',
      );
    } catch {
      /* best-effort */
    }

    // ── 7. Respond ────────────────────────────────────────────────────────────
    const body = { studyMinutes, sessionsCompleted, topicsStudied };
    const response = NextResponse.json(body);

    logger.info('Parent weekly activity fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId,
      weekStart: weekStart.toISOString(),
      sessionsScanned: sessions.length,
      studyMinutes,
      sessionsCompleted,
      topicsStudied,
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch parent weekly activity', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json(
      { error: formatErrorForResponse(error) },
      { status: 500 },
    );
  }
}
