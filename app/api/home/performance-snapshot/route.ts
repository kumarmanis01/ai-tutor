/**
 * FILE OBJECTIVE:
 * - Returns the last 5 practice results for the student with topic names,
 *   accuracy, and date. Also computes average accuracy and weakest topic.
 * - No AI. No charts. Pure Prisma aggregation.
 *
 * Response shape:
 *   {
 *     recentResults: { topicName, accuracy, date }[],
 *     averageAccuracy: number,   // 0-1
 *     weakestTopic: string | null
 *   }
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json(
      { recentResults: [], averageAccuracy: 0, weakestTopic: null },
      { status: 401 }
    );
  }

  // ── Last 5 completed test results ────────────────────────────────────────
  const results = await prisma.testResult.findMany({
    where: {
      studentId: userId,
      score: { not: null },
      finishedAt: { not: null },
    },
    orderBy: { finishedAt: 'desc' },
    take: 5,
    select: {
      testId: true,
      score: true,
      finishedAt: true,
    },
  });

  if (results.length === 0) {
    return NextResponse.json({ recentResults: [], averageAccuracy: 0, weakestTopic: null });
  }

  // ── Resolve topic names via GeneratedTest → TopicDef ─────────────────────
  const testIds = results.map((r) => r.testId);

  const generatedTests = await prisma.generatedTest.findMany({
    where: { id: { in: testIds } },
    select: {
      id: true,
      topic: { select: { name: true } },
    },
  });

  const topicNameByTestId = new Map<string, string>(
    generatedTests.map((gt) => [gt.id, gt.topic?.name ?? 'Unknown Topic'])
  );

  // ── Build response ────────────────────────────────────────────────────────
  const recentResults = results.map((r) => ({
    topicName: topicNameByTestId.get(r.testId) ?? 'Unknown Topic',
    accuracy: r.score != null ? r.score / 100 : 0,
    date: r.finishedAt?.toISOString().slice(0, 10) ?? '',
  }));

  const averageAccuracy =
    recentResults.length > 0
      ? recentResults.reduce((sum, r) => sum + r.accuracy, 0) / recentResults.length
      : 0;

  // Weakest = lowest accuracy among the 5 results
  const weakest = recentResults.reduce<(typeof recentResults)[0] | null>((min, r) => {
    if (!min || r.accuracy < min.accuracy) return r;
    return min;
  }, null);

  return NextResponse.json({
    recentResults,
    averageAccuracy: Math.round(averageAccuracy * 100) / 100,
    weakestTopic: weakest?.topicName ?? null,
  });
}
