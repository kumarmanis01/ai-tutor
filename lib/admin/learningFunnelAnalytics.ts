import { prisma } from '@/lib/prisma';

export interface LearningFunnelStages {
  recommendationComputed: number;
  sessionStarted: number;
  explanationViewed: number;
  practiceCompleted: number;
  testCompleted: number;
  homeworkCompleted: number;
  sessionCompleted: number;
}

export interface LearningFunnelSummary {
  from: Date;
  to: Date;
  stages: LearningFunnelStages;
  rates: Record<string, number>;
  dropoffs: Record<string, { count: number; dropPct: number }>;
  dataQuality: {
    hasRecommendationComputed: boolean;
    homeworkEventCoveragePct: number;
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function rate(n: number, d: number): number {
  if (d <= 0) return 0;
  return clamp01(n / d);
}

function drop(nNext: number, nPrev: number): { count: number; dropPct: number } {
  const count = Math.max(0, nPrev - nNext);
  const dropPct = nPrev > 0 ? clamp01(1 - nNext / nPrev) : 0;
  return { count, dropPct };
}

function hasMetaFlag(meta: unknown, key: string): boolean {
  if (!meta || typeof meta !== 'object') return false;
  return (meta as Record<string, unknown>)[key] === true;
}

function hasMetaObject(meta: unknown, key: string): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const v = (meta as Record<string, unknown>)[key];
  return !!v && typeof v === 'object';
}

function getPracticeTotalAnswers(meta: unknown): number {
  if (!meta || typeof meta !== 'object') return 0;
  const pr = (meta as Record<string, unknown>).practiceResult;
  if (!pr || typeof pr !== 'object') return 0;
  const ta = (pr as Record<string, unknown>).totalAnswers;
  return typeof ta === 'number' && Number.isFinite(ta) ? ta : 0;
}

export async function getLearningFunnelSummary(opts: {
  from: Date;
  to: Date;
}): Promise<LearningFunnelSummary> {
  const from = opts.from;
  const to = opts.to;

  const sessions = await prisma.structuredSession.findMany({
    where: { startedAt: { gte: from, lte: to } },
    select: { id: true, meta: true, state: true, completedAt: true },
    take: 200_000,
  });

  type StructuredSessionRow = { id: string; meta?: any; state?: string | null; completedAt?: Date | null }
  const sessionsRows = sessions as StructuredSessionRow[]
  const sessionIds = sessionsRows.map((s: StructuredSessionRow) => s.id);

  const homeworkSubmitted = sessionIds.length
    ? (await prisma.sessionEvent.findMany({
        where: { sessionId: { in: sessionIds }, eventType: 'HOMEWORK_SUBMITTED' },
        select: { sessionId: true },
        distinct: ['sessionId'],
      })) as { sessionId: string }[]
    : [];
  const homeworkSet = new Set((homeworkSubmitted as { sessionId: string }[]).map((r: { sessionId: string }) => r.sessionId));

  // Optional top-stage: recommendationComputed from HomeRecommendationDecision
  const decisionCount = await prisma.homeRecommendationDecision.count({
    where: { evaluatedAt: { gte: from, lte: to } },
  }).catch(() => 0);

  let explanationViewed = 0;
  let practiceCompleted = 0;
  let testCompleted = 0;
  let homeworkCompleted = 0;
  let sessionCompleted = 0;

  for (const s of sessionsRows) {
    if (hasMetaFlag(s.meta, 'explanationViewed')) explanationViewed++;
    if (getPracticeTotalAnswers(s.meta) >= 1) practiceCompleted++;
    if (hasMetaObject(s.meta, 'testResult')) testCompleted++;
    if (homeworkSet.has(s.id)) homeworkCompleted++;
    if (s.state === 'COMPLETE' && s.completedAt) sessionCompleted++;
  }

  const stages: LearningFunnelStages = {
    recommendationComputed: decisionCount,
    sessionStarted: sessions.length,
    explanationViewed,
    practiceCompleted,
    testCompleted,
    homeworkCompleted,
    sessionCompleted,
  };

  const hasRecommendationComputed = decisionCount > 0;

  const rates = {
    // If recommendationComputed exists, expose start rate; otherwise session-first rates.
    startRateFromRecommendation: hasRecommendationComputed ? rate(stages.sessionStarted, stages.recommendationComputed) : 0,
    explanationViewRate: rate(stages.explanationViewed, stages.sessionStarted),
    practiceCompletionRate: rate(stages.practiceCompleted, stages.explanationViewed),
    testCompletionRate: rate(stages.testCompleted, stages.practiceCompleted),
    homeworkCompletionRate: rate(stages.homeworkCompleted, stages.testCompleted),
    sessionCompletionRate: rate(stages.sessionCompleted, stages.homeworkCompleted),
    endToEndFromSessionStart: rate(stages.sessionCompleted, stages.sessionStarted),
  };

  const dropoffs = {
    rec_to_start: drop(stages.sessionStarted, stages.recommendationComputed),
    start_to_explanation: drop(stages.explanationViewed, stages.sessionStarted),
    explanation_to_practice: drop(stages.practiceCompleted, stages.explanationViewed),
    practice_to_test: drop(stages.testCompleted, stages.practiceCompleted),
    test_to_homework: drop(stages.homeworkCompleted, stages.testCompleted),
    homework_to_complete: drop(stages.sessionCompleted, stages.homeworkCompleted),
  };

  const homeworkEventCoveragePct = clamp01(rate(stages.homeworkCompleted, stages.sessionStarted));

  return {
    from,
    to,
    stages,
    rates,
    dropoffs,
    dataQuality: {
      hasRecommendationComputed,
      homeworkEventCoveragePct,
    },
  };
}

