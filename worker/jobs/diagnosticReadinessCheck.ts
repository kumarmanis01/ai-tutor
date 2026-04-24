/**
 * diagnosticReadinessCheck
 *
 * Scans Redis for pending "diagnostic:notify:{userId}:{subjectId}" keys set when
 * a student clicked "Notify me when ready" on the diagnostic waiting screen.
 *
 * For each pending key it checks whether questions are now available:
 *   1. TopicDef records exist for the subject (syllabus hydrated)
 *   2. At least one Question or GeneratedQuestion is available for those topics
 *
 * When questions are ready it:
 *   - Sends an email to the student
 *   - Deletes the Redis key so the notification is sent exactly once
 *
 * Called from runDailyMaintenanceJob in worker/scheduler.ts.
 *
 * Never throws -- all errors are logged and skipped so maintenance continues.
 */

import { prisma } from '../../lib/prisma.js';
import { getRedis } from '../../lib/redis.js';
import { sendMail } from '../../lib/mailer.js';
import { diagnosticReadyEmailHtml } from '../../lib/email/templates.js';
import { logger } from '../../lib/logger.js';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com';
const KEY_PATTERN = 'diagnostic:notify:*';
const SCAN_COUNT = 100;

export async function runDiagnosticReadinessCheck(): Promise<{ checked: number; notified: number }> {
  let checked = 0;
  let notified = 0;

  const redis = getRedis();
  if (!redis) {
    logger.warn('[diagnosticReadinessCheck] Redis unavailable -- skipping', {
      event: 'diagnostic.ready_notification.redis_unavailable',
    });
    return { checked: 0, notified: 0 };
  }

  try {
    // Incremental SCAN to avoid blocking Redis with a KEYS command on large keyspaces.
    let cursor = '0';
    do {
      const [nextCursor, keys]: [string, string[]] = await (redis as any).scan(
        cursor,
        'MATCH',
        KEY_PATTERN,
        'COUNT',
        SCAN_COUNT,
      );
      cursor = nextCursor;

      for (const key of keys) {
        checked++;
        try {
          // Key format: diagnostic:notify:{userId}:{subjectId}
          const parts = key.split(':');
          if (parts.length < 4) {
            logger.warn('[diagnosticReadinessCheck] malformed key -- skipping', { key });
            continue;
          }
          const userId = parts[2];
          const subjectId = parts[3];

          const isReady = await isDiagnosticReady(subjectId);
          if (!isReady) continue;

          // Fetch student email and name
          const student = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          });
          if (!student?.email) {
            // No email on record -- clear the key so it doesn't keep polling
            await (redis as any).del(key);
            continue;
          }

          // Fetch subject name for the email copy
          const subject = await prisma.subjectDef.findUnique({
            where: { id: subjectId },
            select: { name: true },
          });
          const subjectName = subject?.name ?? 'your subject';
          const studentName = student.name ?? 'there';
          const diagnosticUrl = `${BASE_URL}/diagnostic/${subjectId}`;

          const html = diagnosticReadyEmailHtml({ studentName, subjectName, diagnosticUrl });

          // Use sendMail (throws on failure) so we only delete the key after a
          // confirmed send. sendMailSafe would suppress errors and cause the key
          // to be deleted even when the email never reached the student.
          try {
            await sendMail({
              to: student.email,
              subject: `Your ${subjectName} diagnostic is ready -- start now`,
              html,
            });
            await (redis as any).del(key);
            notified++;
            logger.info('[diagnosticReadinessCheck] notification sent', {
              event: 'diagnostic.ready_notification.sent',
              context: { studentId: userId, subjectId, subjectName },
            });
          } catch (mailErr) {
            // Leave the key intact so the next daily run retries.
            logger.error('[diagnosticReadinessCheck] email send failed -- key preserved for retry', {
              event: 'diagnostic.ready_notification.email_failed',
              context: { studentId: userId, subjectId, error: String(mailErr) },
            });
          }
        } catch (keyErr) {
          logger.error('[diagnosticReadinessCheck] error processing key', {
            event: 'diagnostic.ready_notification.key_error',
            context: { key, error: String(keyErr) },
          });
        }
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.error('[diagnosticReadinessCheck] outer error', {
      event: 'diagnostic.ready_notification.outer_error',
      context: { error: String(err) },
    });
  }

  return { checked, notified };
}

async function isDiagnosticReady(subjectId: string): Promise<boolean> {
  try {
    const topicIds = await prisma.topicDef
      .findMany({
        where: { chapter: { subjectId, lifecycle: 'active' }, lifecycle: 'active' },
        select: { id: true },
      })
      .then((rows: Array<{ id: string }>) => rows.map((r) => r.id));

    if (topicIds.length === 0) return false;

    const qCount = await prisma.question.count({
      where: { status: 'ACTIVE', topicId: { in: topicIds } },
    });
    if (qCount > 0) return true;

    const gqCount = await prisma.generatedQuestion.count({
      where: {
        test: {
          lifecycle: 'active',
          topic: { lifecycle: 'active', chapter: { lifecycle: 'active', subjectId } },
        },
      },
    });
    return gqCount > 0;
  } catch (error) {
    logger.warn('[diagnosticReadinessCheck] isDiagnosticReady check failed -- treating as not ready', {
      event: 'diagnostic.ready_notification.readiness_check_error',
      context: { subjectId, error: String(error) },
    });
    return false;
  }
}
