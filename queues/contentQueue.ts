// src/queues/contentQueue.ts
import { Queue } from "bullmq"
import IORedis from "ioredis"
import { redis } from "@/lib/redis";


/**
 * Each queue represents ONE stage of AI generation.
 * Separation allows retries, pause/resume, and observability.
 */

export const syllabusQueue = new Queue("syllabus-queue", {
  connection: redis,
});

export const notesQueue = new Queue("notes-queue", {
  connection: redis,
});

export const questionsQueue = new Queue("questions-queue", {
  connection: redis,
});

const connection = new IORedis(process.env.REDIS_URL!)

export const contentQueue = new Queue("content-hydration", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false
  }
})
