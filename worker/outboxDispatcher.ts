/**
 * FILE OBJECTIVE:
 * - Poll the Outbox table and dispatch unsent messages to BullMQ content-hydration queue.
 * - RISK-04: Move rows exceeding MAX_ATTEMPTS to OutboxDeadLetter to prevent infinite retry loops.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/outboxDispatcher.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-21T00:00:00Z | copilot-agent | created as worker-integrated outbox dispatcher
 * - 2026-03-07T00:00:00Z | RISK-04 | dead-letter queue, MAX_ATTEMPTS, poll 5s
 */

import { Queue } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants';

/** RISK-04: Max dispatch attempts before moving to dead-letter. Prevents infinite retry loops. */
const MAX_ATTEMPTS = 10;

/** RISK-04: Poll interval 5s (was 1s) to reduce load and allow transient failures to resolve. */
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_MS || 5000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 10);

let queue: Queue | null = null;
let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(CONTENT_HYDRATION_QUEUE, { connection: getSharedConnection() });
  }
  return queue;
}

/**
 * Move an outbox row to dead-letter table and delete from outbox.
 * RISK-04: Prevents infinite retry loops.
 */
async function moveToDeadLetter(
  row: { id: string; queue: string; payload: unknown; meta: unknown; attempts: number },
  reason: string
): Promise<void> {
  const failedAt = new Date();
  try {
    await prisma.$transaction([
      prisma.outboxDeadLetter.create({
        data: {
          originalOutboxId: row.id,
          queue: row.queue,
          payload: row.payload as object,
          meta: (row.meta as object) ?? undefined,
          attempts: row.attempts,
          deadLetterReason: reason,
          failedAt,
        },
      }),
      prisma.outbox.delete({ where: { id: row.id } }),
    ]);
    logger.warn('[outbox-dispatcher] moved to dead-letter', {
      outboxId: row.id,
      reason,
      attempts: row.attempts,
    });
  } catch (e) {
    logger.error('[outbox-dispatcher] failed to move to dead-letter', {
      outboxId: row.id,
      error: e,
    });
  }
}

async function dispatchBatch(): Promise<number> {
  // Find oldest unsent outbox rows
  const rows = await prisma.outbox.findMany({
    where: { sentAt: null },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (!rows || rows.length === 0) {
    return 0;
  }

  let dispatched = 0;
  const q = getQueue();

  for (const row of rows) {
    // If the row has a scheduled delivery time in meta.deliverAt, skip until that time
    try {
      const metaAny = row.meta as any;
      if (metaAny?.deliverAt) {
        const deliverAt = new Date(metaAny.deliverAt);
        if (deliverAt.getTime() > Date.now()) {
          logger.info('[outbox-dispatcher] skipping scheduled row (not due yet)', {
            outboxId: row.id,
            deliverAt: metaAny.deliverAt,
          });
          continue;
        }
      }
    } catch (err) {
      // Non-fatal: if meta parsing fails, fall through and attempt dispatch
    }
    // RISK-04: Exceeded max attempts -- move to dead-letter, skip dispatch
    if (row.attempts >= MAX_ATTEMPTS) {
      await moveToDeadLetter(row, 'max_attempts_exceeded');
      continue;
    }

    try {
      const payload = row.payload as { type?: string; payload?: { jobId?: string } };
      if (!payload?.type) {
        logger.error('[outbox-dispatcher] invalid payload, moving to dead-letter', {
          outboxId: row.id,
          payload,
        });
        await moveToDeadLetter({ ...row, attempts: row.attempts + 1 }, 'missing_payload_type');
        continue;
      }
      const jobName = `${payload.type.toLowerCase()}-${payload.payload?.jobId ?? row.id}`;

      // Add to Bull queue
      const job = await q.add(jobName, payload, { jobId: payload.payload?.jobId });

      // Mark outbox row as sent
      await prisma.outbox.update({
        where: { id: row.id },
        data: { sentAt: new Date(), attempts: row.attempts + 1 },
      });

      logger.info('[outbox-dispatcher] dispatched', { outboxId: row.id, bullJobId: job.id });
      dispatched++;
    } catch (err) {
      logger.error('[outbox-dispatcher] failed to dispatch row', { outboxId: row.id, error: err });
      const newAttempts = row.attempts + 1;

      // RISK-04: Exceeded max attempts after this failure -- move to dead-letter
      if (newAttempts >= MAX_ATTEMPTS) {
        const reason = err instanceof Error ? err.message : String(err);
        await moveToDeadLetter({ ...row, attempts: newAttempts }, `dispatch_failed: ${reason}`);
      } else {
        await prisma.outbox
          .update({
            where: { id: row.id },
            data: { attempts: newAttempts },
          })
          .catch(() => {});
      }
    }
  }

  return dispatched;
}

/**
 * Start the outbox dispatcher polling loop.
 * Safe to call multiple times (idempotent).
 */
export function startOutboxDispatcher(): void {
  if (running) {
    logger.info('[outbox-dispatcher] already running');
    return;
  }

  running = true;
  logger.info('[outbox-dispatcher] starting', {
    pollInterval: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  });

  // Run initial dispatch immediately
  dispatchBatch().catch((err) => {
    logger.error('[outbox-dispatcher] initial batch error', { error: err });
  });

  // Then poll on interval
  intervalId = setInterval(async () => {
    try {
      await dispatchBatch();
    } catch (err) {
      logger.error('[outbox-dispatcher] poll error', { error: err });
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the outbox dispatcher polling loop.
 */
export async function stopOutboxDispatcher(): Promise<void> {
  running = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (queue) {
    await queue.close().catch(() => {});
    queue = null;
  }

  logger.info('[outbox-dispatcher] stopped');
}

export { dispatchBatch };
