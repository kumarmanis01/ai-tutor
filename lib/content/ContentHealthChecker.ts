import { prisma } from '@/lib/prisma';
import { QuestionStatus, ContentGapStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

const TARGET_PER_BAND = Number(process.env.DIAGNOSTIC_TARGET_QUESTIONS_PER_BAND ?? 5);
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const CONCURRENCY = 5;

export interface ContentHealthSummary {
  subjectsScanned: number;
  topicsScanned: number;
  gapsDetected: number;
  gapsResolved: number;
  durationMs: number;
}

// Inline concurrency limiter -- avoids adding p-limit as a new dependency.
// Runs `tasks` with at most `limit` in flight simultaneously.
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function drain() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, drain));
  return results;
}

export async function runContentHealthCheck(): Promise<ContentHealthSummary> {
  const start = Date.now();
  let subjectsScanned = 0;
  let topicsScanned = 0;
  let gapsDetected = 0;
  let gapsResolved = 0;

  const subjects = await prisma.subjectDef.findMany({
    where: { lifecycle: 'active' },
    select: {
      id: true,
      class: { select: { grade: true, board: { select: { slug: true } } } },
      chapters: {
        where: { lifecycle: 'active' },
        select: {
          topics: {
            where: { lifecycle: 'active' },
            select: { id: true },
          },
        },
      },
    },
  });

  subjectsScanned = subjects.length;

  type TopicEntry = { subjectId: string; boardSlug: string; grade: number; topicId: string };
  const entries: TopicEntry[] = [];

  for (const subject of subjects) {
    const boardSlug = subject.class.board.slug;
    const grade = subject.class.grade;
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        entries.push({ subjectId: subject.id, boardSlug, grade, topicId: topic.id });
      }
    }
  }

  topicsScanned = entries.length;

  const tasks = entries.map((entry) => async () => {
    for (const difficulty of DIFFICULTIES) {
      try {
        const count = await prisma.question.count({
          where: {
            topicId: entry.topicId,
            difficulty,
            type: 'mcq',
            status: QuestionStatus.ACTIVE,
          },
        });

        if (count < TARGET_PER_BAND) {
          const existing = await prisma.contentGap.findUnique({
            where: { topicId_difficulty: { topicId: entry.topicId, difficulty } },
          });

          if (!existing) {
            await prisma.contentGap.create({
              data: {
                topicId: entry.topicId,
                subjectId: entry.subjectId,
                boardSlug: entry.boardSlug,
                grade: entry.grade,
                difficulty,
                currentCount: count,
                targetCount: TARGET_PER_BAND,
                status: ContentGapStatus.detected,
              },
            });
            gapsDetected++;
          } else if (existing.status === ContentGapStatus.resolved) {
            // Count dropped back below threshold after a previous resolution -- re-open.
            await prisma.contentGap.update({
              where: { id: existing.id },
              data: {
                status: ContentGapStatus.detected,
                currentCount: count,
                resolvedAt: null,
                hydrationJobId: null,
              },
            });
            gapsDetected++;
          } else if (
            existing.status === ContentGapStatus.detected ||
            existing.status === ContentGapStatus.hydration_pending
          ) {
            await prisma.contentGap.update({
              where: { id: existing.id },
              data: { currentCount: count },
            });
          }
          // ignored: do not touch -- content ops deliberately left this topic thin.
        } else {
          // Count meets threshold -- resolve any open gap.
          const existing = await prisma.contentGap.findUnique({
            where: { topicId_difficulty: { topicId: entry.topicId, difficulty } },
          });
          if (
            existing &&
            existing.status !== ContentGapStatus.resolved &&
            existing.status !== ContentGapStatus.ignored
          ) {
            await prisma.contentGap.update({
              where: { id: existing.id },
              data: {
                status: ContentGapStatus.resolved,
                resolvedAt: new Date(),
                currentCount: count,
              },
            });
            gapsResolved++;
          }
        }
      } catch (err) {
        logger.error('content-health-checker.topic.error', {
          topicId: entry.topicId,
          difficulty,
          error: String(err),
        });
      }
    }
  });

  await withConcurrencyLimit(tasks, CONCURRENCY);

  const durationMs = Date.now() - start;
  logger.info('content-health-checker.scan.complete', {
    subjectsScanned,
    topicsScanned,
    gapsDetected,
    gapsResolved,
    durationMs,
  });

  return { subjectsScanned, topicsScanned, gapsDetected, gapsResolved, durationMs };
}
