/**
 * FILE OBJECTIVE:
 * - Poll the Outbox table and dispatch unsent messages to BullMQ content-hydration queue.
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
 */

import { Queue } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { redisConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_MS || 1000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 10);

let queue: Queue | null = null;
let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue('content-hydration', { connection: redisConnection });
  }
  return queue;
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
    try {
      const payload = row.payload as { type?: string; payload?: { jobId?: string } };
      if (!payload?.type) {
        logger.error('[outbox-dispatcher] skipping row with missing payload.type', { outboxId: row.id, payload });
        await prisma.outbox.update({ where: { id: row.id }, data: { sentAt: new Date(), attempts: row.attempts + 1 } }).catch(() => {});
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
      // Increment attempts but don't mark as sent
      await prisma.outbox.update({
        where: { id: row.id },
        data: { attempts: row.attempts + 1 },
      }).catch(() => {}); // Ignore secondary errors
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
  logger.info('[outbox-dispatcher] starting', { pollInterval: POLL_INTERVAL_MS, batchSize: BATCH_SIZE });

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
