/**
 * FILE OBJECTIVE:
 * - Compute per-topic difficulty index from mastery and progress signals.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/curriculumDifficultyIntelligence.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-23T05:45:00Z | copilot | fix(strict): add explicit TopicRow type and cast Prisma results to remove implicit-any in callbacks
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Local DB row typings
type TopicRow = {
  id: string;
  name: string;
  chapter?: { name?: string | null; subject?: { name?: string | null } | null } | null;
};

export interface TopicDifficultyRow {
  topicId: string;
  topicName: string;
  chapterName: string;
  subjectName: string;
  attemptedStudents: number;
  masteryRows: number;
  avgAccuracy: number | null;
  medianAttempts: number | null;
  weakRate: number | null;
  speedMedian: number | null;
  difficultyIndex: number | null;
  lowData: boolean;
}

export interface TopicDifficultyListResult {
  from: Date;
  to: Date;
  items: TopicDifficultyRow[];
}

type TopicMeta = { topicName: string; chapterName: string; subjectName: string };
type MasteryAggRow = {
  topicId: string;
  attemptedStudents: number;
  masteryRows: number;
  avgAccuracy: number | null;
  medianAttempts: number | null;
  speedMedian: number | null;
};
type WeakAggRow = { topicId: string; weakStudents: number; attemptedStudents: number };

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Computes a per-topic difficulty index (0-100) from existing signals:
 * - Avg accuracy (StudentTopicMastery.accuracy)
 * - Median attempts (StudentTopicMastery.questionsAttempted)
 * - Weak-topic frequency (StudentTopicProgress weak definition)
 * - Speed proxy (accuracy / daysSinceFirstAttempt)
 *
 * Note: this uses Postgres percentile_cont via $queryRaw for medians.
 */
export async function getTopicDifficultyList(opts: {
  from: Date;
  to: Date;
  subjectId?: string;
  limit?: number;
}): Promise<TopicDifficultyListResult> {
  const from = opts.from;
  const to = opts.to;
  const limit = Math.min(opts.limit ?? 100, 500);

  // 1) Base topic + hierarchy list (active topics only)
  const topics = (await prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      ...(opts.subjectId ? { chapter: { subjectId: opts.subjectId } } : {}),
    },
    select: {
      id: true,
      name: true,
      chapter: {
        select: {
          name: true,
          subject: { select: { name: true } },
        },
      },
    },
  })) as TopicRow[];

  if (topics.length === 0) {
    return { from, to, items: [] };
  }

  const topicIds = topics.map((t) => t.id);
  const topicMeta = new Map<string, TopicMeta>(
    topics.map((t) => [
      t.id,
      {
        topicName: t.name,
        chapterName: t.chapter?.name ?? '--',
        subjectName: t.chapter?.subject?.name ?? '--',
      },
    ])
  );

  // 2) Mastery aggregates (avg accuracy, counts, median attempts, median speed proxy)
  const masteryAgg = (await prisma.$queryRaw(Prisma.sql`
    SELECT
      "topicId" as "topicId",
      COUNT(DISTINCT "studentId")::int as "attemptedStudents",
      COUNT(*)::int as "masteryRows",
      AVG("accuracy") as "avgAccuracy",
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "questionsAttempted") as "medianAttempts",
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY
          CASE
            WHEN "lastAttemptedAt" IS NULL THEN NULL
            ELSE ("accuracy" / GREATEST(1, EXTRACT(EPOCH FROM ("lastAttemptedAt" - "createdAt")) / 86400.0))
          END
      ) as "speedMedian"
    FROM "StudentTopicMastery"
    WHERE "topicId" IN (${Prisma.join(topicIds)})
      AND "lastAttemptedAt" IS NOT NULL
      AND "lastAttemptedAt" >= ${from}
      AND "lastAttemptedAt" <= ${to}
    GROUP BY "topicId"
  `)) as MasteryAggRow[];

  const masteryMap = new Map<string, MasteryAggRow>(masteryAgg.map((r) => [r.topicId, r]));

  // 3) Weak-topic frequency (weak students / attempted students)
  const weakAgg = (await prisma.$queryRaw(Prisma.sql`
    SELECT
      "topicId" as "topicId",
      COUNT(DISTINCT CASE WHEN "mastery" < 0.4 AND "practiceCount" > 5 THEN "studentId" END)::int as "weakStudents",
      COUNT(DISTINCT CASE WHEN "practiceCount" > 0 THEN "studentId" END)::int as "attemptedStudents"
    FROM "StudentTopicProgress"
    WHERE "topicId" IN (${Prisma.join(topicIds)})
    GROUP BY "topicId"
  `)) as WeakAggRow[];

  const weakMap = new Map<string, WeakAggRow>(weakAgg.map((r) => [r.topicId, r]));

  // 4) Normalize attempts and speed within this result set (rank-based min/max fallback).
  const attemptVals = masteryAgg
    .map((r) => r.medianAttempts ?? null)
    .filter((v): v is number => v != null);
  const speedVals = masteryAgg
    .map((r) => r.speedMedian ?? null)
    .filter((v): v is number => v != null);
  const attemptMin = attemptVals.length ? Math.min(...attemptVals) : 0;
  const attemptMax = attemptVals.length ? Math.max(...attemptVals) : 0;
  const speedMin = speedVals.length ? Math.min(...speedVals) : 0;
  const speedMax = speedVals.length ? Math.max(...speedVals) : 0;

  function normMinMax(v: number, min: number, max: number): number {
    if (max <= min) return 0;
    return clamp01((v - min) / (max - min));
  }

  const items: TopicDifficultyRow[] = topicIds
    .map((topicId) => {
      const meta = topicMeta.get(topicId)!;
      const m = masteryMap.get(topicId);
      const w = weakMap.get(topicId);

      const attemptedStudents = m?.attemptedStudents ?? 0;
      const masteryRows = m?.masteryRows ?? 0;
      const avgAccuracy = m?.avgAccuracy ?? null;
      const medianAttempts = m?.medianAttempts ?? null;
      const speedMedian = m?.speedMedian ?? null;
      const weakRate = w && w.attemptedStudents > 0 ? w.weakStudents / w.attemptedStudents : null;

      const lowData = attemptedStudents < 30 || masteryRows < 30;

      // Components (0-1) where higher means harder
      const nA = avgAccuracy == null ? null : clamp01(1 - avgAccuracy);
      const nP =
        medianAttempts == null
          ? null
          : normMinMax(
              Math.log(1 + medianAttempts),
              Math.log(1 + attemptMin),
              Math.log(1 + attemptMax)
            );
      const nS =
        speedMedian == null ? null : clamp01(1 - normMinMax(speedMedian, speedMin, speedMax));
      const nW = weakRate == null ? null : clamp01(weakRate);

      const comps = [nA, nP, nS, nW].filter((x): x is number => x != null);
      const difficultyIndex =
        comps.length >= 2
          ? 100 * (0.4 * (nA ?? 0) + 0.25 * (nP ?? 0) + 0.2 * (nS ?? 0) + 0.15 * (nW ?? 0))
          : null;

      return {
        topicId,
        topicName: meta.topicName,
        chapterName: meta.chapterName,
        subjectName: meta.subjectName,
        attemptedStudents,
        masteryRows,
        avgAccuracy,
        medianAttempts,
        weakRate,
        speedMedian,
        difficultyIndex,
        lowData,
      };
    })
    .sort((a, b) => (b.difficultyIndex ?? -1) - (a.difficultyIndex ?? -1))
    .slice(0, limit);

  return { from, to, items };
}
