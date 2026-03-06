/**
 * Weak Topic Detection
 *
 * A topic is "weak" when the student has practiced it meaningfully
 * (practiceCount > PRACTICE_MIN) but mastery remains below the threshold.
 * This distinguishes genuinely struggling topics from ones that are simply
 * un-started.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const MASTERY_THRESHOLD = 0.4;
const PRACTICE_MIN = 5;

export interface WeakTopic {
  topicId: string;
  mastery: number;
  practiceCount: number;
  lastStudiedAt: Date;
}

/**
 * Returns all topics where the student has tried (practiceCount > 5)
 * but mastery is still below 0.4.
 */
export async function getWeakTopics(studentId: string): Promise<WeakTopic[]> {
  const rows = await prisma.studentTopicProgress.findMany({
    where: {
      studentId,
      mastery: { lt: MASTERY_THRESHOLD },
      practiceCount: { gt: PRACTICE_MIN },
    },
    select: {
      topicId: true,
      mastery: true,
      practiceCount: true,
      lastStudiedAt: true,
    },
    orderBy: { mastery: 'asc' },
  });

  logger.debug('[WEAK_TOPICS]', { studentId, count: rows.length });

  return rows;
}

/**
 * Returns a Set of weak topicIds for fast lookup in scoring loops.
 */
export async function getWeakTopicIds(studentId: string): Promise<Set<string>> {
  const topics = await getWeakTopics(studentId);
  return new Set(topics.map((t) => t.topicId));
}
