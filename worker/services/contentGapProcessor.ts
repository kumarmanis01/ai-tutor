import { prisma } from '@/lib/prisma.js';
import { ContentGapStatus, JobType } from '@prisma/client';
import { JobStatus } from '@/lib/ai-engine/types';
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants';
import { logger } from '@/lib/logger.js';

type GapRecord = {
  id: string;
  topicId: string;
  subjectId: string;
  boardSlug: string;
  grade: number;
  difficulty: string;
  currentCount: number;
  targetCount: number;
  topic: {
    chapterId: string;
    chapter: {
      subject: { name: string; targetLanguage: string | null };
    };
  };
};

export interface ContentGapProcessorSummary {
  gapsQueued: number;
  topicsEnqueued: number;
  durationMs: number;
}

/**
 * Reads all detected ContentGap records and enqueues one QUESTIONS HydrationJob
 * per unique topicId.
 *
 * One QUESTIONS job generates all 3 difficulty levels for a topic, so gaps for
 * easy/medium/hard on the same topic are collapsed into a single enqueue.
 * BullMQ dedup: the Outbox payload includes a dedupKey so the dispatcher can
 * skip re-enqueueing if a job with the same key is already in the queue.
 */
export async function processContentGaps(): Promise<ContentGapProcessorSummary> {
  const start = Date.now();
  let gapsQueued = 0;
  let topicsEnqueued = 0;

  const detectedGaps = await prisma.contentGap.findMany({
    where: { status: ContentGapStatus.detected },
    select: {
      id: true,
      topicId: true,
      subjectId: true,
      boardSlug: true,
      grade: true,
      difficulty: true,
      currentCount: true,
      targetCount: true,
      topic: {
        select: {
          chapterId: true,
          chapter: {
            select: {
              subject: {
                select: {
                  name: true,
                  targetLanguage: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (detectedGaps.length === 0) {
    logger.info('content-gap-processor.no_detected_gaps');
    return { gapsQueued: 0, topicsEnqueued: 0, durationMs: Date.now() - start };
  }

  // Group gaps by topicId -- one QUESTIONS job covers all difficulties for the topic.
  const byTopic = new Map<string, GapRecord[]>();
  for (const gap of (detectedGaps as GapRecord[])) {
    const existing = byTopic.get(gap.topicId) ?? [];
    existing.push(gap);
    byTopic.set(gap.topicId, existing);
  }

  for (const [topicId, gaps] of byTopic) {
    const first = gaps[0];
    const chapterId = first.topic.chapterId;
    const subjectName = first.topic.chapter.subject.name;

    try {
      const hydrationJobId = await prisma.$transaction(async (tx) => {
        const hydrationJob = await tx.hydrationJob.create({
          data: {
            jobType: JobType.questions,
            topicId,
            chapterId,
            subjectId: first.subjectId,
            subject: subjectName,
            board: first.boardSlug,
            grade: first.grade,
            // Language: use subject targetLanguage if set (LANGUAGE subjects),
            // otherwise default to English.
            language: (first.topic.chapter.subject.targetLanguage ?? 'en') as any,
            difficulty: 'easy' as any, // handler generates all 3 -- field used for filtering only
            status: JobStatus.Pending,
            hierarchyLevel: 3, // questions-level job (same as reconciler-created jobs)
            attempts: 0,
            maxAttempts: 3,
            inputParams: {
              topicId,
              chapterId,
              source: 'content-gap-processor',
              gapIds: gaps.map((g) => g.id),
            },
          },
        });

        // Outbox entry -- dedupKey prevents duplicate BullMQ jobs for the same topic.
        await tx.outbox.create({
          data: {
            queue: CONTENT_HYDRATION_QUEUE,
            payload: {
              type: 'QUESTIONS',
              payload: { jobId: hydrationJob.id },
              dedupKey: `content-gap:${topicId}`,
            },
            meta: {
              hydrationJobId: hydrationJob.id,
              topicId,
              chapterId,
              source: 'content-gap-processor',
            },
          },
        });

        return hydrationJob.id;
      });

      // Mark all gaps for this topicId as hydration_pending with the job reference.
      await prisma.contentGap.updateMany({
        where: { id: { in: gaps.map((g) => g.id) } },
        data: {
          status: ContentGapStatus.hydration_pending,
          hydrationJobId,
        },
      });

      topicsEnqueued++;
      gapsQueued += gaps.length;

      logger.info('content-gap-processor.enqueued', {
        topicId,
        hydrationJobId,
        gapCount: gaps.length,
        difficulties: gaps.map((g) => g.difficulty),
      });
    } catch (err) {
      logger.error('content-gap-processor.enqueue.error', {
        topicId,
        error: String(err),
      });
    }
  }

  const durationMs = Date.now() - start;
  logger.info('content-gap-processor.complete', {
    gapsQueued,
    topicsEnqueued,
    durationMs,
  });

  return { gapsQueued, topicsEnqueued, durationMs };
}
