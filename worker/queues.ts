import { Queue } from "bullmq";
import { getSharedConnection } from "../lib/redis.js";

export const CONTENT_QUEUE = "content-engine";

/**
 * Create and return a Queue configured for content processing.
 *
 * IMPORTANT:
 * Pass the shared IORedis instance (not ConnectionOptions) so BullMQ reuses
 * the existing connection rather than opening a new one per Queue.
 * Workers must keep using ConnectionOptions -- they need dedicated blocking connections.
 */
export function createContentQueue() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set");
  }

  return new Queue(CONTENT_QUEUE, {
    connection: getSharedConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}
