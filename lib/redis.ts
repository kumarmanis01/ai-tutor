// src/lib/redis.ts
import IORedis from "ioredis";

let _redis: IORedis | null = null;

export function getRedis() {
  if (_redis) return _redis;
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }
  _redis = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // REQUIRED for BullMQ
  });
  return _redis;
}

export function _resetRedisForTests() {
  // test helper: closes and clears the cached redis client
  if (_redis) {
    try {
      _redis.disconnect();
    } catch (e) {
      // Use the project's logger utility instead of console methods
      import("../lib/logger").then(({ logger }) => {
      logger.error("Failed to disconnect Redis client during test reset", { error: e });
      });
    }
    _redis = null;
  }
}
