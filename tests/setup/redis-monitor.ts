/**
 * FILE OBJECTIVE:
 * - Test-time ioredis tracker to detect and close leaked Redis clients between tests.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/redis/client.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | added Redis tracking and afterEach cleanup for Jest
 */

// Keep a weak list of created ioredis clients so tests don't leak connections
const createdClients = new Set<any>()

try {
  // Load original ioredis and create a tracking subclass that registers instances
  // This file runs before tests that import modules creating Redis clients (via jest.setupFilesAfterEnv)
  // so substituting the module export here will affect subsequent requires.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const OriginalRedis = require('ioredis')

  class TrackingRedis extends OriginalRedis {
    constructor(...args: any[]) {
        // @ts-expect-error TODO: fix types - forward to parent constructor
        super(...args)
      createdClients.add(this)
      try {
        this.once?.('close', () => createdClients.delete(this))
        this.once?.('end', () => createdClients.delete(this))
      } catch {
        /* ignore */
      }
    }
  }

  // Overwrite the cached module export so later requires receive TrackingRedis
  try {
    const resolved = require.resolve('ioredis')
    const mod = require.cache[resolved]
    if (mod) {
      mod.exports = TrackingRedis
    } else {
      // if not cached, prime the cache entry
      require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: TrackingRedis }
    }
  } catch {
    // if require.resolve or cache manipulation fails, we still benefit from our own direct imports
  }
} catch {
  // ioredis not installed or failed to load; nothing to track
}

// After each test, attempt to gracefully close any tracked clients to avoid hitting Redis maxclients
afterEach(async () => {
  if (createdClients.size === 0) return
  const clients = Array.from(createdClients)
  for (const c of clients) {
    try {
      if (typeof c.quit === 'function') {
        await c.quit()
      } else if (typeof c.disconnect === 'function') {
        c.disconnect()
      }
    } catch {
      try { c.disconnect?.() } catch {}
    } finally {
      createdClients.delete(c)
    }
  }
})

export {}
