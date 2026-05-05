/**
 * FILE OBJECTIVE:
 * - GET /api/student/diagnostic/results/[subjectId]
 * - Returns per-chapter mastery bands for the knowledge map visualisation.
 *   Satisfies F-STU-002 AC-06: colour-coded knowledge map (RED < 40%, AMBER 40-70%, GREEN > 70%).
 *   Also surfaces placement (below / at / above grade) and recommended starting chapter.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/diagnostic/results.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04 | staff-engineer | created -- F-STU-002 AC-06 knowledge map
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type MasteryBand = 'RED' | 'AMBER' | 'GREEN';

function scoreToBand(score: number): MasteryBand {
  if (score < 0.4) return 'RED';
  if (score <= 0.7) return 'AMBER';
  return 'GREEN';
}

function derivePlacement(avgMastery: number): 'below' | 'at' | 'above' {
  if (avgMastery < 0.4) return 'below';
  if (avgMastery <= 0.7) return 'at';
  return 'above';
}

interface Params {
  params: Promise<{ subjectId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'DiagnosticResultsAPI', methodName: 'GET' }, start);
    return res;
  }

  const { subjectId } = await params;
  if (!subjectId) {
    const res = NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'DiagnosticResultsAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    // 1. Load all active chapters for this subject in curriculum order.
    const chapters = await prisma.chapterDef.findMany({
      where: { subjectId, lifecycle: 'active' },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true },
    });

    if (chapters.length === 0) {
      const res = NextResponse.json({ placement: null, chapters: [], recommendedStartChapterId: null });
      logger.logAPI(req, res, { className: 'DiagnosticResultsAPI', methodName: 'GET' }, start);
      return res;
    }

    // 2. Load StudentConceptState rows for this student + subject.
    //    Concept.subjectId is denormalised so we can filter without joining through topics.
    const conceptStates = await prisma.studentConceptState.findMany({
      where: {
        studentId: userId,
        concept: { subjectId },
      },
      select: {
        masteryScore: true,
        concept: {
          select: {
            topic: { select: { chapterId: true } },
          },
        },
      },
    });

    // 3. Aggregate masteryScore per chapterId.
    const chapterAgg = new Map<string, { sum: number; count: number }>();
    for (const state of conceptStates) {
      const chapterId = state.concept?.topic?.chapterId;
      if (!chapterId) continue;
      const existing = chapterAgg.get(chapterId) ?? { sum: 0, count: 0 };
      chapterAgg.set(chapterId, { sum: existing.sum + state.masteryScore, count: existing.count + 1 });
    }

    // 4. Count active concepts per chapter via a raw group-by (Prisma groupBy cannot
    //    filter across two relation hops simultaneously).
    const chapterConceptCounts = new Map<string, number>();
    const chapterIds = chapters.map((ch) => ch.id);
    if (chapterIds.length > 0) {
      const rawCounts = await prisma.$queryRaw<{ chapterId: string; cnt: bigint }[]>`
        SELECT t."chapterId", COUNT(c.id) AS cnt
        FROM "Concept" c
        JOIN "TopicDef" t ON t.id = c."topicId"
        WHERE t."chapterId" = ANY(${chapterIds}::text[])
          AND t.lifecycle = 'active'
        GROUP BY t."chapterId"
      `;
      for (const row of rawCounts) {
        chapterConceptCounts.set(row.chapterId, Number(row.cnt));
      }
    }

    // 5. Build per-chapter result rows.
    let totalMasterySum = 0;
    let totalMasteryCount = 0;
    let recommendedStartChapterId: string | null = null;
    let lowestMastery = Infinity;

    const chapterResults = chapters.map((ch) => {
      const agg = chapterAgg.get(ch.id);
      const avgMastery = agg ? agg.sum / agg.count : 0;
      const masteryPct = Math.round(avgMastery * 100);
      const band = scoreToBand(avgMastery);

      totalMasterySum += avgMastery;
      totalMasteryCount += 1;

      // Recommended start: earliest RED chapter with lowest mastery.
      if (band === 'RED' && avgMastery < lowestMastery) {
        lowestMastery = avgMastery;
        recommendedStartChapterId = ch.id;
      }

      return {
        chapterId: ch.id,
        chapterName: ch.name,
        order: ch.order,
        masteryPct,
        band,
        conceptCount: chapterConceptCounts.get(ch.id) ?? 0,
        isRecommendedStart: false, // set below after all chapters processed
      };
    });

    // If no RED chapters found, recommend the first AMBER chapter in order.
    if (!recommendedStartChapterId) {
      const firstAmber = chapterResults.find((c) => c.band === 'AMBER');
      if (firstAmber) recommendedStartChapterId = firstAmber.chapterId;
    }
    // Final fallback: all chapters GREEN -- recommend the lowest-mastery chapter.
    if (!recommendedStartChapterId && chapterResults.length > 0) {
      const lowestMastery = chapterResults.reduce((min, c) => c.masteryPct < min.masteryPct ? c : min);
      recommendedStartChapterId = lowestMastery.chapterId;
    }

    // Mark recommended chapter.
    for (const ch of chapterResults) {
      ch.isRecommendedStart = ch.chapterId === recommendedStartChapterId;
    }

    const overallAvg = totalMasteryCount > 0 ? totalMasterySum / totalMasteryCount : 0;
    const placement = derivePlacement(overallAvg);

    const res = NextResponse.json({ placement, chapters: chapterResults, recommendedStartChapterId });
    logger.logAPI(req, res, { className: 'DiagnosticResultsAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('[diagnostic/results] error', {
      className: 'DiagnosticResultsAPI',
      methodName: 'GET',
      userId,
      subjectId,
      error: String((err as Error)?.message ?? err),
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticResultsAPI', methodName: 'GET' }, start);
    return res;
  }
}
