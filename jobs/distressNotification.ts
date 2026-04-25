import { Queue } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';

export interface DistressNotificationJobData {
  studentId: string;
  sessionId: string;
  turnId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggerPhrases: string[];
  studentMessage: string; // already PII-redacted by input safety
}

export const DISTRESS_NOTIFICATION_QUEUE_NAME = 'distress-notification';

let distressQueue: Queue<DistressNotificationJobData> | null = null;

export function getDistressNotificationQueue(): Queue<DistressNotificationJobData> {
  if (!distressQueue) {
    distressQueue = new Queue<DistressNotificationJobData>(DISTRESS_NOTIFICATION_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return distressQueue;
}

export async function enqueueDistressNotification(
  data: DistressNotificationJobData
): Promise<void> {
  try {
    const queue = getDistressNotificationQueue();
    await queue.add('distress-notification', data);
  } catch (err) {
    logger.error('[distress-notification] enqueue failed', {
      error: String((err as any)?.message ?? err),
      studentId: data.studentId,
      severity: data.severity,
    });
  }
}
