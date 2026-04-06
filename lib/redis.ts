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
    return null;
  }
  const url = process.env.REDIS_URL!
  // Single, shared client with conservative retry/reconnect settings so that
  // transient Memurai/Redis issues do not crash workers or web handlers.
  const opts: any = {
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      // Exponential-ish backoff up to 30s
      const delay = Math.min(1000 * Math.pow(2, times), 30_000);
      return delay;
    },
    reconnectOnError(err: Error) {
      const msg = err?.message || '';
      // Reconnect on READONLY (failover) and connection reset style errors
      if (/READONLY/i.test(msg)) return true;
      if (/ECONNRESET|EPIPE|ETIMEDOUT|connection.*closed/i.test(msg)) return true;
      return false;
    },
  }
  // Enable TLS options when using rediss:// or explicit env toggle
  if (url.startsWith('rediss://') || process.env.REDIS_USE_TLS === '1') {
    const tls: any = {}
    if (process.env.REDIS_TLS_SERVERNAME) tls.servername = process.env.REDIS_TLS_SERVERNAME
    if (process.env.REDIS_TLS_REJECT_UNAUTHORIZED === '0') tls.rejectUnauthorized = false
    if (Object.keys(tls).length) opts.tls = tls
  }
  const client = new IORedis(url, opts);

  // Attach lightweight logging for connection-level issues; avoid circular
  // imports by using a dynamic import of the logger module. Emit richer
  // context (error.code/name/address/port/stack and the client's options)
  // so runtime errors are actionable instead of producing empty messages.
  client.on('error', (err: any) => {
    import('../lib/logger')
      .then(({ error }) => {
        try {
          error('redis.client_error', {
            message: String(err?.message ?? err),
            name: err?.name,
            code: err?.code,
            address: err?.address,
            port: err?.port,
            stack: err?.stack,
            clientOptions: (client as any)?.options,
          });
        } catch {
          // ignore secondary logging failures
        }
      })
      .catch(() => {
        // logger may not be available in some runtimes; ignore
      });
  });

  // Log successful connects so we can correlate which resolved endpoint the
  // process is using (helpful when /etc/hosts or tunnels exist).
  client.on('connect', () => {
    import('../lib/logger')
      .then(({ info }) => {
        try {
          info('redis.connected', { host: (client as any)?.options?.host, port: (client as any)?.options?.port });
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  });

  // Best-effort: query the server's memory info to capture the
  // `maxmemory_policy` value in logs (providers sometimes block CONFIG).
  // Failure is non-fatal and ignored.
  client
    .info('memory')
    .then((infoStr: string) => {
      try {
        const m = infoStr.match(/maxmemory_policy:(\S+)/);
        import('../lib/logger')
          .then(({ info }) => {
            try {
              info('redis.info.memory', { maxmemory_policy: m?.[1] ?? 'unknown' });
            } catch {}
          })
          .catch(() => {});
      } catch {
        // ignore parse errors
      }
    })
    .catch(() => {
      // info command may be blocked by provider; ignore
    });

  _redis = client;
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
