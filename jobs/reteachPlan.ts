import { Queue } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';

export interface ReteachPlanJobData {
  studentId: string;
  conceptId: string;
}

export const RETEACH_PLAN_QUEUE_NAME = 'reteach-plan';

let reteachPlanQueue: Queue<ReteachPlanJobData> | null = null;

export function getReteachPlanQueue(): Queue<ReteachPlanJobData> {
  if (!reteachPlanQueue) {
    reteachPlanQueue = new Queue<ReteachPlanJobData>(RETEACH_PLAN_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return reteachPlanQueue;
}

/**
 * Enqueue a re-teach LearningPlanItem insertion for a student who scored ≤ 80%
 * on a revision card session. Idempotent: the worker deduplicates by
 * (studentId, conceptId) before inserting.
 * Never throws — logs on enqueue failure.
 */
export async function enqueueReteachPlan(data: ReteachPlanJobData): Promise<void> {
  try {
    const queue = getReteachPlanQueue();
    await queue.add('insert-reteach-item', data, {
      // Deduplicate by student+concept within 24h to avoid spamming the plan
      jobId: `reteach:${data.studentId}:${data.conceptId}:${new Date().toISOString().slice(0, 10)}`,
    });
    logger.info('reteachPlan.enqueued', {
      event: 'reteach_plan_enqueued',
      context: { studentId: data.studentId, conceptId: data.conceptId },
    });
  } catch (err) {
    logger.error('reteachPlan.enqueue.error', {
      error: String((err as any)?.message ?? err),
      studentId: data.studentId,
      conceptId: data.conceptId,
    });
  }
}
