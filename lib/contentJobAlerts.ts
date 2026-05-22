/**
 * lib/contentJobAlerts.ts
 *
 * Auto-retry scheduling and admin alert emails for content hydration job
 * failures. Called from worker/processors/contentWorker.ts.
 *
 * Retry strategy:
 *  1. Bull retries transient failures up to 3 times (built into queue config).
 *  2. After all Bull attempts exhaust, this module schedules a delayed 24h re-enqueue
 *     tracked with a Redis counter. Max 2 such auto-retries (MAX_AUTO_RETRIES).
 *  3. If the counter reaches the max, the job is marked permanently failed and
 *     an admin email is sent with no willRetryAt -- requiring manual intervention.
 */

import type { Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { contentJobFailureAlertHtml } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';
import { JobStatus } from '@/lib/ai-engine/types';
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { CONTENT_JOB_ADMIN_ALERT_EMAIL } from '@/lib/email/functionalityEmails';

const MAX_AUTO_RETRIES = 2;
const AUTO_RETRY_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_RETRY_KEY_PREFIX = 'content:autoretry:';
const AUTO_RETRY_KEY_TTL_S = 72 * 60 * 60; // 72 hours in seconds

function autoRetryKey(hydrationJobId: string): string {
  return `${AUTO_RETRY_KEY_PREFIX}${hydrationJobId}`;
}

export async function getAutoRetryCount(hydrationJobId: string): Promise<number> {
  try {
    const redis = getRedis();
    if (!redis) return 0;
    const val = await redis.get(autoRetryKey(hydrationJobId));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Attempts to schedule a 24-hour delayed Bull retry for a failed hydration job.
 * Returns { scheduled: true, retryNumber } if a retry was queued, or
 * { scheduled: false, retryNumber } if the auto-retry cap has been reached.
 *
 * Side effects when scheduled=true:
 *  - Redis counter incremented
 *  - HydrationJob status reset to "pending"
 *  - New Bull job enqueued with 24h delay
 */
export async function scheduleAutoRetry(
  hydrationJobId: string,
  bullJob: Job,
  subject: string,
  grade: number,
  lastError: string,
): Promise<{ scheduled: boolean; retryNumber: number }> {
  const redis = getRedis();
  if (!redis) return { scheduled: false, retryNumber: 0 };
  const key = autoRetryKey(hydrationJobId);

  let currentCount = 0;
  try {
    const val = await redis.get(key);
    currentCount = val ? parseInt(val, 10) : 0;
  } catch {
    // If Redis is unavailable, conservatively skip scheduling to avoid double-retries.
    return { scheduled: false, retryNumber: 0 };
  }

  if (currentCount >= MAX_AUTO_RETRIES) {
    return { scheduled: false, retryNumber: currentCount };
  }

  const nextCount = currentCount + 1;

  try {
    // Increment counter before enqueuing so a crash between the two steps
    // doesn't cause an extra retry on the next failure check.
    await redis.set(key, String(nextCount), 'EX', AUTO_RETRY_KEY_TTL_S);

    // Reset HydrationJob to pending so the re-enqueued job can claim it.
    await prisma.hydrationJob.update({
      where: { id: hydrationJobId },
      data: { status: JobStatus.Pending, lockedAt: null, lastError: lastError },
    });

    // Re-enqueue with 24h delay using the same job data.
    const { getContentQueue } = await import('@/queues/contentQueue');
    const jobName = bullJob.name ?? 'hydration';
    await getContentQueue().add(jobName, bullJob.data, {
      delay: AUTO_RETRY_DELAY_MS,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  } catch (err) {
    // Rollback counter increment on scheduling failure so the next real
    // failure attempt can still try to schedule.
    try {
      await redis.set(key, String(currentCount), 'EX', AUTO_RETRY_KEY_TTL_S);
    } catch { /* ignore */ }
    throw err;
  }

  return { scheduled: true, retryNumber: nextCount };
}

/**
 * Sends an admin alert email about a content job failure.
 * Uses sendMailSafe -- fire-and-forget, never throws.
 *
 * When willRetryAt is provided, the email says the job will be retried.
 * When omitted, the email signals that manual intervention is needed.
 */
export async function sendJobFailureAlert(opts: {
  hydrationJobId: string;
  lastError: string;
  subject: string;
  grade: number;
  board: string;
  willRetryAt?: Date;
}): Promise<void> {
  const adminEmail =
    process.env.ADMIN_ALERT_EMAIL ?? CONTENT_JOB_ADMIN_ALERT_EMAIL;
  const adminUrl =
    `${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/admin/jobs`;

  // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
  const html = contentJobFailureAlertHtml({
    hydrationJobId: opts.hydrationJobId,
    lastError: opts.lastError,
    subject: opts.subject,
    grade: opts.grade,
    board: opts.board,
    adminUrl,
    willRetryAt: opts.willRetryAt,
  });

  const subject = opts.willRetryAt
    ? `[Spinzy] Content job will retry at ${opts.willRetryAt.toLocaleString('en-IN')}`
    : `[Spinzy] Content job needs attention: ${opts.hydrationJobId}`;

  await sendEmailUnifiedSafe({
    mode: 'raw',
    delivery: 'best_effort',
    to: adminEmail,
    subject,
    html,
    reason: 'content_job_failure_alert',
    featureFlagDomain: 'ops',
  });
}
