// src/queues/contentQueue.ts
/**
 * AI CONTENT ENGINE NOTICE:
 * - Queue/Redis clients must be lazy-initialized, never at module import time.
 * - Always use getter functions to create queues on demand.
 * - Do not instantiate queues outside these functions.
 */
import { Queue } from "bullmq";
import { getSharedConnection } from "@/lib/redis";
import { CONTENT_HYDRATION_QUEUE } from "@/lib/queues/constants";

/**
 * Lazy-init factories for queues to avoid creating Redis/Queue instances at import time.
 * Use `getSyllabusQueue()` etc. from API handlers or workers.
 *
 * EDIT LOG:
 * - 2026-04-18T18:00:00Z | copilot | use getSharedConnection() so all Queues share the
 *   singleton IORedis instance instead of each opening a separate TCP connection.
 */

type QueuesMap = {
  syllabus?: Queue;
  notes?: Queue;
  questions?: Queue;
  content?: Queue;
};

const queues: QueuesMap = {};

function getConnection() {
  // Returns the shared IORedis singleton rather than ConnectionOptions so BullMQ
  // reuses the existing TCP connection instead of opening a new one per Queue.
  return getSharedConnection();
}

export function getSyllabusQueue() {
  if (!queues.syllabus) {
    queues.syllabus = new Queue("syllabus-queue", { connection: getConnection() });
  }
  return queues.syllabus;
}

export function getNotesQueue() {
  if (!queues.notes) {
    queues.notes = new Queue("notes-queue", { connection: getConnection() });
  }
  return queues.notes;
}

export function getQuestionsQueue() {
  if (!queues.questions) {
    queues.questions = new Queue("questions-queue", { connection: getConnection() });
  }
  return queues.questions;
}

export function getContentQueue() {
  if (!queues.content) {
    queues.content = new Queue(CONTENT_HYDRATION_QUEUE, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return queues.content;
}
