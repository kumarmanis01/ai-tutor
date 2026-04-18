/**
 * FILE OBJECTIVE:
 * - Provide a lazy-init shared ioredis client with safe error handling and an explicit disconnect helper for tests and workers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/redis/client.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | created lazy Redis client wrapper to reduce connection leaks in tests
 */

import Redis from 'ioredis'
import { logger } from '@/lib/logger'

let client: Redis | null = null

export function getRedis(): Redis {
  if (client) return client

  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  client = new Redis(url, {
    // defensive defaults to reduce resource pressure in CI
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 10000,
  } as any)

  client.on('error', (err: Error) => {
    try {
      logger.error('[redis] error', { error: err?.message ?? String(err) })
    } catch {
      // swallow logging errors
    }
  })

  client.on('close', () => {
    try {
      logger.info('[redis] connection closed')
    } catch {}
    client = null
  })

  return client
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return
  try {
    await client.quit()
  } catch (_err) {
    try {
      client.disconnect()
    } catch {
      /* swallow */
    }
  } finally {
    client = null
  }
}

export default getRedis
