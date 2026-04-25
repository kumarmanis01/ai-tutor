/**
 * GET /api/admin/metrics/learning-outcomes
 * F-ADM-031 AC-01, AC-02, AC-03: Aggregate learning outcome metrics.
 *
 * AC-01: mastery gain per session -- avg(masteryScore) / avg(attemptCount) across active students
 * AC-02: chapter completion rate -- StudentConceptState rows with masteryScore > 0.75 / total rows
 * AC-03: mock exam improvement -- avg(lastScore - firstScore) for students with >= 2 attempts
 *
 * Query param: days (default 30, max 90) -- lookback window for exam attempts.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MASTERY_COMPLETION_THRESHOLD = 0.75;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const rawDays = parseInt(url.searchParams.get('days') ?? String(DEFAULT_DAYS), 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, MAX_DAYS) : DEFAULT_DAYS;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  type MasteryRow = { avgMasteryScore: number | null; avgAttemptCount: number | null };
  type CompletionRow = { total: bigint; completed: bigint };
  type ExamImprovementRow = { avgImprovement: number | null; studentCount: bigint };

  const [masteryRow, completionRow, examRow] = await Promise.all([
    // AC-01: mastery gain proxy -- avg mastery per attempt across all concept states
    prisma.$queryRaw<MasteryRow[]>`
      SELECT
        AVG("masteryScore")::float   AS "avgMasteryScore",
        AVG("attemptCount")::float   AS "avgAttemptCount"
      FROM "StudentConceptState"
      WHERE "attemptCount" > 0
    `,

    // AC-02: chapter completion rate (masteryScore > threshold)
    prisma.$queryRaw<CompletionRow[]>`
      SELECT
        COUNT(*)::bigint                                                      AS total,
        COUNT(*) FILTER (WHERE "masteryScore" > ${MASTERY_COMPLETION_THRESHOLD})::bigint
                                                                              AS completed
      FROM "StudentConceptState"
    `,

    // AC-03: mock exam improvement -- per-student first vs latest scorePercent
    prisma.$queryRaw<ExamImprovementRow[]>`
      WITH ranked AS (
        SELECT
          "studentId",
          "scorePercent",
          ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "startedAt" ASC)  AS rn_first,
          ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "startedAt" DESC) AS rn_last,
          COUNT(*) OVER (PARTITION BY "studentId")                               AS attempt_count
        FROM "MockExamAttempt"
        WHERE "scorePercent" IS NOT NULL
          AND "startedAt" >= ${since}
      ),
      first_last AS (
        SELECT
          "studentId",
          MAX(CASE WHEN rn_first = 1 THEN "scorePercent" END) AS first_score,
          MAX(CASE WHEN rn_last  = 1 THEN "scorePercent" END) AS last_score
        FROM ranked
        WHERE attempt_count >= 2
        GROUP BY "studentId"
      )
      SELECT
        AVG(last_score - first_score)::float AS "avgImprovement",
        COUNT(*)::bigint                     AS "studentCount"
      FROM first_last
    `,
  ]);

  const avgMasteryScore = masteryRow[0]?.avgMasteryScore ?? null;
  const avgAttemptCount = masteryRow[0]?.avgAttemptCount ?? null;
  const masteryGainPerSession =
    avgMasteryScore !== null && avgAttemptCount !== null && avgAttemptCount > 0
      ? avgMasteryScore / avgAttemptCount
      : null;

  const total = Number(completionRow[0]?.total ?? 0);
  const completed = Number(completionRow[0]?.completed ?? 0);
  const chapterCompletionRate = total > 0 ? completed / total : null;

  const avgExamImprovement = examRow[0]?.avgImprovement ?? null;
  const studentsWithImprovementData = Number(examRow[0]?.studentCount ?? 0);

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    masteryGainPerSession:
      masteryGainPerSession !== null ? Math.round(masteryGainPerSession * 10000) / 10000 : null,
    chapterCompletionRate:
      chapterCompletionRate !== null ? Math.round(chapterCompletionRate * 10000) / 10000 : null,
    chapterCompletionThreshold: MASTERY_COMPLETION_THRESHOLD,
    totalConceptStates: total,
    completedConceptStates: completed,
    avgExamScoreImprovement:
      avgExamImprovement !== null ? Math.round(avgExamImprovement * 100) / 100 : null,
    studentsWithExamImprovementData: studentsWithImprovementData,
  });
}
