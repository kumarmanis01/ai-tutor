import { Queue } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { DiagnosticBootstrapJobData } from '@/worker/services/diagnosticBootstrapWorker';

export const DIAGNOSTIC_BOOTSTRAP_QUEUE_NAME = 'diagnostic-bootstrap';

let diagnosticBootstrapQueue: Queue<DiagnosticBootstrapJobData> | null = null;

export function getDiagnosticBootstrapQueue() {
  if (!diagnosticBootstrapQueue) {
    diagnosticBootstrapQueue = new Queue<DiagnosticBootstrapJobData>(
      DIAGNOSTIC_BOOTSTRAP_QUEUE_NAME,
      {
        connection: getSharedConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }
    );
  }
  return diagnosticBootstrapQueue;
}

export async function enqueueDiagnosticBootstrapJob(data: DiagnosticBootstrapJobData) {
  const queue = getDiagnosticBootstrapQueue();
  try {
    await queue.add('bootstrap-concepts', data);
  } catch (err) {
    logger.error('[diagnostic-bootstrap] failed to enqueue job', {
      error: String((err as any)?.message ?? err),
      data,
    });
  }
}
