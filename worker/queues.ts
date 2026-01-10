import { Queue } from "bullmq";

export const CONTENT_QUEUE = "content-engine";

/**
 * Create and return a Queue configured for content processing.
 *
 * IMPORTANT:
 * BullMQ expects *connection options*, NOT an ioredis instance.
 * Never pass a Redis client here.
 */
export function createContentQueue() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set");
  }

  return new Queue(CONTENT_QUEUE, {
    connection: {
      url: process.env.REDIS_URL,
    },
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
