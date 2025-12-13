// src/lib/redis.ts
import IORedis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined in environment variables");
}

export const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // REQUIRED for BullMQ
});
