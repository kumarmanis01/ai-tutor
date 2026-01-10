// src/queues/contentQueue.ts
/**
 * AI CONTENT ENGINE NOTICE:
 * - Queue/Redis clients must be lazy-initialized, never at module import time.
 * - Always use getter functions to create queues on demand.
 * - Do not instantiate queues outside these functions.
 */
import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

/**
 * Lazy-init factories for queues to avoid creating Redis/Queue instances at import time.
 * Use `getSyllabusQueue()` etc. from API handlers or workers.
 */

type QueuesMap = {
  syllabus?: Queue;
  notes?: Queue;
  questions?: Queue;
  content?: Queue;
};

const queues: QueuesMap = {};

function getConnection() {
  return redisConnection;
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
    queues.content = new Queue("content-hydration", {
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
