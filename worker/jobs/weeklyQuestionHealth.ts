/**
 * FILE OBJECTIVE:
 * - Weekly health report for the question bank. Emits an analytics event
 *   with counts and flags concepts/topics with low active question counts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/weeklyQuestionHealth.test.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created weekly question health job
 */

import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

const LOW_QUESTION_THRESHOLD = 5;

/**
 * Run weekly question health job.
 * - Counts active questions per topic
 * - Emits analytics event `weekly_question_health` with summary
 * - Returns number of low-health topics detected
 */
export async function runWeeklyQuestionHealth(): Promise<number> {
  logger.info('weeklyQuestionHealth.starting');

  // Total questions (any status)
  const totalQuestions = await prisma.question.count();

  // Active questions grouped by topicId
  // Prisma's generated groupBy types can be extremely deep and cause circular
  // mapped-type errors in TS. Cast the `groupBy` call itself to `any` to
  // avoid complex type resolution while still keeping a typed `topicCounts`
  // result at runtime.
  const grouped = await (prisma.question.groupBy as any)({
    by: ['topicId'],
    where: { status: 'ACTIVE' },
    _count: { id: true },
  });

  // Map topicId -> count
  const topicCounts = grouped
    .filter((g: any) => g.topicId)
    .reduce((acc: Record<string, number>, g: any) => {
      acc[g.topicId] = g._count?.id ?? 0;
      return acc;
    }, {});

  // Find topics below threshold
  const lowTopicIds = (Object.entries(topicCounts) as [string, number][])
    .filter(([, cnt]) => cnt < LOW_QUESTION_THRESHOLD)
    .map(([topicId]) => topicId);

  // Fetch topic names for reporting
  const topics = lowTopicIds.length
    ? await prisma.topicDef.findMany({
        where: { id: { in: lowTopicIds } },
        select: { id: true, name: true },
      })
    : [];

  const lowTopics = topics.map((t: { id: string; name: string }) => ({
    id: t.id,
    name: t.name,
    count: topicCounts[t.id] ?? 0,
  }));

  // Emit analytics event with summary and low topics list
  await prisma.analyticsEvent.create({
    data: {
      eventType: 'weekly_question_health',
      metadata: {
        totalQuestions,
        activeByTopic: topicCounts,
        lowTopics,
        threshold: LOW_QUESTION_THRESHOLD,
      },
    },
  });

  if (lowTopics.length > 0) {
    logger.warn('weeklyQuestionHealth.lowTopics', { count: lowTopics.length, lowTopics });
  }

  logger.info('weeklyQuestionHealth.completed', { totalQuestions, lowTopics: lowTopics.length });
  return lowTopics.length;
}

export default runWeeklyQuestionHealth;
