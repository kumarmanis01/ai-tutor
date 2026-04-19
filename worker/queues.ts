import { Queue } from "bullmq";
import { getSharedConnection } from "../lib/redis.js";

export const CONTENT_QUEUE = "content-engine";

/**
 * Create and return a Queue configured for content processing.
 *
 * IMPORTANT:
 * Use the `getSharedConnection()` helper so Queue instances can reuse an
 * existing IORedis client when available, reducing per-process TCP connections.
 * This helper will fall back to `ConnectionOptions` when a shared client is
 * not available (e.g., build-time or unit tests).
 *
 * WARNING: Never pass a shared client to `new Worker()`. Workers require a
 * dedicated blocking connection for blocking operations and should continue to
 * use plain `ConnectionOptions` (the `redisConnection` export) instead.
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
