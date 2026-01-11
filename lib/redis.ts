// src/lib/redis.ts
import IORedis from "ioredis";
import type { ConnectionOptions } from 'bullmq';

// Use InstanceType to capture the runtime Redis client type without relying
// on the package's exported type shape which can differ between CJS/ESM builds.
let _redis: InstanceType<typeof IORedis> | null = null;

// Build a connection object for BullMQ; include TLS options when requested.
const _url = process.env.REDIS_URL || undefined
const _tlsOpts: any = {}
if (_url && (_url.startsWith('rediss://') || process.env.REDIS_USE_TLS === '1')) {
  if (process.env.REDIS_TLS_SERVERNAME) _tlsOpts.servername = process.env.REDIS_TLS_SERVERNAME
  if (process.env.REDIS_TLS_REJECT_UNAUTHORIZED === '0') _tlsOpts.rejectUnauthorized = false
}

export const redisConnection: ConnectionOptions = _url
  ? ({ url: _url, tls: Object.keys(_tlsOpts).length ? _tlsOpts : undefined } as any)
  : ({} as any)

export function getRedis() {
  if (_redis) return _redis;
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }
  const url = process.env.REDIS_URL!
  const opts: any = { maxRetriesPerRequest: null }
  // Enable TLS options when using rediss:// or explicit env toggle
  if (url.startsWith('rediss://') || process.env.REDIS_USE_TLS === '1') {
    const tls: any = {}
    if (process.env.REDIS_TLS_SERVERNAME) tls.servername = process.env.REDIS_TLS_SERVERNAME
    if (process.env.REDIS_TLS_REJECT_UNAUTHORIZED === '0') tls.rejectUnauthorized = false
    if (Object.keys(tls).length) opts.tls = tls
  }
  _redis = new IORedis(url, opts)
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
