import { Queue } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const DIAGNOSTIC_AUTO_SUBMIT_QUEUE_NAME = 'diagnostic-auto-submit';

export interface DiagnosticAutoSubmitJobData {
  userId: string;
  subjectId: string;
  /** Redis session id for adaptive sessions; undefined for legacy partial-save flow. */
  sessionId?: string;
}

let autoSubmitQueue: Queue<DiagnosticAutoSubmitJobData> | null = null;

function getAutoSubmitQueue() {
  if (!autoSubmitQueue) {
    autoSubmitQueue = new Queue<DiagnosticAutoSubmitJobData>(DIAGNOSTIC_AUTO_SUBMIT_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    });
  }
  return autoSubmitQueue;
}

/** Stable job id so a re-save replaces the earlier delayed job for the same session. */
function jobId(userId: string, subjectId: string) {
  return `auto-submit:${userId}:${subjectId}`;
}

/**
 * Enqueue (or replace) a delayed auto-submit job for 24 hours from now.
 * Idempotent: a duplicate save-partial for the same student/subject removes the
 * previous job and schedules a fresh 24h window.
 */
export async function enqueueDiagnosticAutoSubmit(
  data: DiagnosticAutoSubmitJobData
): Promise<void> {
  const queue = getAutoSubmitQueue();
  const id = jobId(data.userId, data.subjectId);
  try {
    // Remove any existing pending job so the 24h clock resets on each save.
    const existing = await queue.getJob(id);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' || state === 'waiting') {
        await existing.remove();
      }
    }
    await queue.add('auto-submit', data, {
      jobId: id,
      delay: 24 * 60 * 60 * 1000, // 24 hours
    });
    logger.info('[diagnostic-auto-submit] scheduled', {
      userId: data.userId,
      subjectId: data.subjectId,
    });
  } catch (err) {
    // Non-fatal: if scheduling fails the student can still manually submit.
    logger.warn('[diagnostic-auto-submit] failed to schedule', {
      userId: data.userId,
      subjectId: data.subjectId,
      error: String(err),
    });
  }
}

/**
 * Cancel a pending auto-submit job (called on successful manual submit).
 */
export async function cancelDiagnosticAutoSubmit(userId: string, subjectId: string): Promise<void> {
  const queue = getAutoSubmitQueue();
  const id = jobId(userId, subjectId);
  try {
    const existing = await queue.getJob(id);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' || state === 'waiting') {
        await existing.remove();
        logger.info('[diagnostic-auto-submit] cancelled on manual submit', { userId, subjectId });
      }
    }
  } catch {
    // non-fatal
  }
}
