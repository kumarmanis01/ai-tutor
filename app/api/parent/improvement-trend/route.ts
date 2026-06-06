export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Returns a week-by-week accuracy trend for a linked student.
 * - Groups StudentTopicMastery rows by ISO week of updatedAt and computes
 *   AVG(accuracy) per week, covering the last 8 complete weeks.
 *
 * TABLE USED: StudentTopicMastery only. No joins.
 *
 * WHY $queryRaw:
 * - Prisma's fluent API cannot express DATE_TRUNC + GROUP BY in a single
 *   round-trip. Fetching all rows for 8 weeks into JS and grouping there
 *   would transfer O(topics × student) rows over the wire for every request.
 *   A raw aggregate query is the correct tool here -- the DB does the math,
 *   the API returns only 8 numbers.
 *
 * ── INDEX ANALYSIS ──────────────────────────────────────────────────────────
 *
 * Indexes that exist on StudentTopicMastery (schema.prisma):
 *   @@unique([studentId, topicId])          ← enforces one row per student-topic
 *   @@index([studentId, masteryLevel])      ← used by mastery-level queries
 *   @@index([subject, chapter])             ← curriculum browse
 *
 * There is NO index on updatedAt or (studentId, updatedAt).
 *
 * What the current query does without a dedicated index:
 *
 *   Index Range Scan on "StudentTopicMastery_studentId_masteryLevel_idx"
 *     → equality probe: studentId = $1          (index hit -- fast)
 *     → heap fetch for every matched row
 *     → heap-filter: updatedAt >= $2            (not in index -- evaluated per row)
 *     → DATE_TRUNC + GROUP BY + AVG on survivors
 *
 * The studentId probe is O(log N) on the index. The updatedAt filter is
 * applied from the heap, meaning Postgres reads every mastery row for this
 * student before discarding those outside the 8-week window.
 *
 * For a student with 50-200 mastery rows this is negligible. If the table
 * grows to thousands of rows per student (many subjects × topics × revisions),
 * add the following index -- zero downtime via CONCURRENTLY:
 *
 *   @@index([studentId, updatedAt])
 *
 *   Prisma equivalent (add to schema.prisma, then migrate):
 *     @@index([studentId, updatedAt])
 *
 *   With this index Postgres can:
 *     1. Probe studentId directly.
 *     2. Range-scan updatedAt >= $2 within the index -- no heap reads for
 *        rows that fall outside the 8-week window.
 *     3. Fetch heap pages only for rows that pass both predicates.
 *
 * SECURITY:
 * - Caller must be authenticated.
 * - parentId-studentId link is verified (O(1) unique-index lookup) before
 *   any student data is read.
 * - studentId is passed via Prisma.sql tagged template -- never string-
 *   concatenated -- so SQL injection is not possible.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Parent Progress Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { predictDaysToReadiness, PLATFORM_DEFAULT_GAIN_PER_SESSION } from '@/lib/parent/dashboardHelpers';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentImprovementTrendAPI';

/** Number of past weeks to return. Kept as a named constant so it appears
 *  in one place -- both in the cutoff date calculation and the response cap. */
const WEEK_WINDOW = 8;

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeeklyAccuracy {
  week: string;     // ISO week label, e.g. "2026-W10"
  accuracy: number; // AVG(accuracy) for that week, rounded to 4 d.p.
}

/**
 * Raw row returned by Postgres.
 * Postgres returns NUMERIC aggregates as strings in the node-postgres driver,
 * so `avg_accuracy` must be coerced to a JS number before use.
 */
interface RawTrendRow {
  week: string;
  avg_accuracy: string | number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a Date set to Monday 00:00:00.000 UTC, exactly `weeksAgo` ISO weeks
 * before the current week. Used to build the updatedAt >= cutoff filter.
 */
function mondayNWeeksAgo(weeksAgo: number): Date {
  const now = new Date();
  const dow = now.getUTCDay();                   // 0 = Sunday
  const distToMonday = dow === 0 ? 6 : dow - 1;

  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - distToMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);

  const cutoff = new Date(thisMonday);
  cutoff.setUTCDate(thisMonday.getUTCDate() - weeksAgo * 7);
  return cutoff;
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/parent/improvement-trend?studentId=<id>
 *
 * Returns up to 8 data points ordered oldest-first:
 *   [{ week: "2026-W01", accuracy: 0.58 }, ...]
 *
 * Weeks where the student had no mastery updates are omitted (sparse series).
 * The client should treat missing weeks as "no data" rather than zero.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'GET';

  try {
    // ── 1. Auth ─────────────────────────────────────────────────────────────
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const parentId = session.user.id;

    // ── 2. Input validation ──────────────────────────────────────────────────
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    // ── 3. Parent-student link guard ─────────────────────────────────────────
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    if (!link || link.status === 'revoked') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // ── 4. Cutoff date ───────────────────────────────────────────────────────
    // e.g. for WEEK_WINDOW=8: Monday 00:00 UTC of the week 8 weeks before now.
    // Rows older than this are excluded from the query entirely.
    const cutoff = mondayNWeeksAgo(WEEK_WINDOW);

    // ── 5. Aggregation query ─────────────────────────────────────────────────
    //
    // SQL executed:
    //
    //   SELECT
    //     TO_CHAR(DATE_TRUNC('week', "updatedAt"), 'IYYY"-W"IW')  AS week,
    //     AVG(accuracy)                                            AS avg_accuracy
    //   FROM "StudentTopicMastery"
    //   WHERE "studentId" = $1          -- equality on indexed leading column
    //     AND "updatedAt" >= $2         -- range filter (heap predicate today;
    //                                   -- index predicate once index is added)
    //   GROUP BY DATE_TRUNC('week', "updatedAt")
    //   ORDER BY DATE_TRUNC('week', "updatedAt") ASC
    //   LIMIT $3;                       -- hard cap: never return > WEEK_WINDOW rows
    //
    // ISO week format breakdown:
    //   IYYY  = ISO year  (handles week-1 of a year that starts in prev calendar year)
    //   "W"   = literal character W
    //   IW    = ISO week number, zero-padded (01-53)
    //   → produces "2026-W10", matching the required response shape exactly.
    //
    // Prisma.sql is a tagged template that passes $1/$2/$3 as prepared-statement
    // parameters. studentId and cutoff are never string-concatenated.
    const rows = (await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          TO_CHAR(DATE_TRUNC('week', "updatedAt"), 'IYYY"-W"IW') AS week,
          AVG(accuracy)                                            AS avg_accuracy
        FROM   "StudentTopicMastery"
        WHERE  "studentId" = ${studentId}
          AND  "updatedAt" >= ${cutoff}
        GROUP  BY DATE_TRUNC('week', "updatedAt")
        ORDER  BY DATE_TRUNC('week', "updatedAt") ASC
        LIMIT  ${WEEK_WINDOW}
      `,
    )) as RawTrendRow[];

    // ── 6. Coerce and shape ──────────────────────────────────────────────────
    // node-postgres returns NUMERIC/FLOAT8 aggregates as strings.
    // Round to 4 decimal places -- enough precision for a trend line without
    // floating-point noise (e.g. 0.5799999... → 0.58).
    const trend: WeeklyAccuracy[] = rows.map((r: any) => ({
      week:     r.week,
      accuracy: Math.round(Number(r.avg_accuracy) * 10_000) / 10_000,
    }));

    // Predict days to reach 80% readiness at current pace (F-PAR-012 AC-05)
    let predictedDaysTo80: number | null = null
    let predictedReadyByDate: string | null = null

    try {
      // Average weekly sessions over last 4 weeks
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      const weeklySummaries = await prisma.weeklyStudentSummary.findMany({ where: { studentId, weekStart: { gte: fourWeeksAgo } }, select: { sessionsCount: true } })
      const totalSessions = weeklySummaries.reduce((s: any, w: any) => s + w.sessionsCount, 0)
      const completedWeeks = Math.max(1, weeklySummaries.length)
      const avgWeeklySessions = totalSessions / completedWeeks

      // Current readiness score: prefer readinessStatus aggregate; fall back to latest trend point
      const agg = await prisma.readinessStatus.aggregate({ where: { studentId }, _avg: { readinessScore: true } })
      let currentScore: number | null = null
      if (agg._avg.readinessScore !== null && agg._avg.readinessScore !== undefined) {
        currentScore = Math.round((agg._avg.readinessScore as number) * 100) / 100
      } else if (trend.length > 0) {
        // trend.accuracy is 0..1; convert to percentage
        const last = trend[trend.length - 1]
        currentScore = Math.round((last.accuracy * 100) * 100) / 100
      }

      if (currentScore !== null && Number.isFinite(currentScore)) {
        const prediction = predictDaysToReadiness(currentScore, 80, avgWeeklySessions, PLATFORM_DEFAULT_GAIN_PER_SESSION)
        if (prediction.feasible && prediction.estimatedDays !== null) {
          predictedDaysTo80 = prediction.estimatedDays
          const targetDate = new Date(Date.now() + predictedDaysTo80 * 24 * 60 * 60 * 1000)
          predictedReadyByDate = targetDate.toISOString().slice(0, 10)
        }
      }
    } catch (err) {
      logger.debug('improvement-trend: prediction failed', { error: String(err) })
    }

    const response = NextResponse.json({ trend, predictedDaysTo80, predictedReadyByDate });

    logger.info('Parent improvement trend fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId,
      weekCount: trend.length,
      cutoff: cutoff.toISOString(),
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch parent improvement trend', {
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
