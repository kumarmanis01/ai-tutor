/**
 * FILE OBJECTIVE:
 * - Ensure nullable columns added to RegenerationJob exist before DB-backed tests run.
 * - Uses a DEDICATED local PrismaClient (never the shared singleton) so this setup
 *   can safely disconnect without affecting any running test.
 * - Registered via beforeAll/afterAll so Jest properly awaits it — eliminates the
 *   fire-and-forget race that previously caused "Engine is not yet connected" failures.
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | rewrite: use local client + beforeAll/afterAll to fix engine race
 */

// Skip in browser (jsdom) environments where Prisma's Node engine cannot run.
const _isNode = typeof (globalThis as any).window === 'undefined'

let _LocalPrismaClient: any | undefined
if (_isNode) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('@prisma/client')
    _LocalPrismaClient = pkg && pkg.PrismaClient
  } catch {
    _LocalPrismaClient = undefined
  }
}

if (_isNode && _LocalPrismaClient && typeof _LocalPrismaClient === 'function') {
  let _localClient: any | null = null

  /**
   * beforeAll: create a dedicated client, run schema migrations, then disconnect it.
   * Using beforeAll means Jest AWAITS this before any test in the file runs —
   * no race condition with the shared prisma singleton.
   */
  beforeAll(async () => {
    try {
      _localClient = new _LocalPrismaClient()
    } catch {
      // Cannot instantiate — skip schema prep silently.
      return
    }

    try {
      // Postgres: add nullable columns if they don't exist yet.
      await _localClient.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP NULL')
      await _localClient.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP NULL')
      await _localClient.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "retryOfJobId" TEXT NULL')
      await _localClient.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "retryIntentId" TEXT NULL')
    } catch {
      // SQLite or locked CI DB — try the simpler form, ignore all errors.
      try { await _localClient.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN lockedAt TEXT') } catch {}
      try { await _localClient.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN completedAt TEXT') } catch {}
      try { await _localClient.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN retryOfJobId TEXT') } catch {}
      try { await _localClient.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN retryIntentId TEXT') } catch {}
    }

    // Clear prepared-statement cache to avoid "cached plan must not change result type".
    try { await _localClient.$executeRawUnsafe('DISCARD ALL') } catch {}
  }, 20000)

  /**
   * afterAll: disconnect the dedicated local client.
   * This NEVER touches the shared `prisma` singleton.
   */
  afterAll(async () => {
    if (_localClient) {
      try { await _localClient.$disconnect() } catch {}
      _localClient = null
    }
  }, 20000)
}
