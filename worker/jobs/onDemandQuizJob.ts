/**
 * BullMQ worker and queue factory for on-demand quiz generation.
 *
 * Queue name: 'on-demand-quiz'
 * Job data:   { requestId: string }
 *
 * The worker calls processOnDemandQuizRequest() which handles:
 *   - Scope resolution
 *   - LLM call with retry
 *   - Validation
 *   - DB persistence
 *
 * Idempotent: processOnDemandQuizRequest atomically claims 'pending' requests.
 * Re-running a job for a non-pending request is a no-op (throws 'request_already_claimed',
 * which is treated as a non-retryable skip).
 */

import { Queue, Worker, Job } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { processOnDemandQuizRequest } from '@/lib/quiz/onDemandQuizService';

const QUEUE_NAME = 'on-demand-quiz';

// ── Queue factory (lazy singleton) ────────────────────────────────────────────

let _queue: Queue | null = null;

export function getOnDemandQuizQueue(): Queue {
  if (_queue) return _queue;
  _queue = new Queue(QUEUE_NAME, {
    connection: getSharedConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
  return _queue;
}

// ── Worker ─────────────────────────────────────────────────────────────────────

export interface OnDemandQuizJobData {
  requestId: string;
}

/**
 * Starts the on-demand quiz worker. Call once during worker bootstrap.
 * Returns the Worker instance so callers can gracefully shut it down.
 */
export function startOnDemandQuizWorker(): Worker {
  const worker = new Worker<OnDemandQuizJobData>(
    QUEUE_NAME,
    async (job: Job<OnDemandQuizJobData>) => {
      const { requestId } = job.data;
      if (!requestId) {
        logger.error('[onDemandQuizJob] missing requestId in job data', {
          event: 'invalid_job_data',
          context: { jobId: job.id },
        });
        return;
      }

      logger.info('[onDemandQuizJob] processing', {
        event: 'job_started',
        context: { requestId, jobId: job.id, attempt: job.attemptsMade },
      });

      try {
        const result = await processOnDemandQuizRequest(requestId);
        logger.info('[onDemandQuizJob] completed', {
          event: 'job_completed',
          context: { requestId, questionCount: result.questionCount },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // request_already_claimed means another worker picked it up -- not an error, skip retry
        if (errMsg === 'request_already_claimed') {
          logger.info('[onDemandQuizJob] request already claimed, skipping', {
            event: 'job_skip',
            context: { requestId },
          });
          return;
        }

        logger.error('[onDemandQuizJob] failed', {
          event: 'job_failed',
          context: { requestId, error: errMsg },
        });
        throw err;
      }
    },
    {
      connection: getSharedConnection(),
      concurrency: Number(process.env.ON_DEMAND_QUIZ_CONCURRENCY || 2),
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('[onDemandQuizJob] worker job failed', {
      event: 'worker_job_failed',
      context: {
        requestId: job?.data?.requestId ?? 'unknown',
        jobId: job?.id ?? 'unknown',
        attempts: job?.attemptsMade ?? 0,
        error: err.message,
      },
    });
  });

  worker.on('error', (err) => {
    logger.error('[onDemandQuizJob] worker error', {
      event: 'worker_error',
      context: { error: err.message },
    });
  });

  logger.info('[onDemandQuizJob] worker started', {
    event: 'worker_started',
    context: { queue: QUEUE_NAME },
  });

  return worker;
}
