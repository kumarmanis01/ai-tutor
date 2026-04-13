import { prisma } from '@/lib/prisma'

// Ensure tests are resilient when new nullable timestamp columns were added to the schema.
// This runs before each test file and will try to add missing columns if the DB supports it.
// Use the application's Prisma singleton so tests reuse the same runtime client
// and avoid accidentally pulling the browser-target client build.

async function ensureColumns() {
  try {
    // Postgres: add columns if not exists
    await prisma.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP NULL')
    await prisma.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP NULL')
    await prisma.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "retryOfJobId" TEXT NULL')
    await prisma.$executeRawUnsafe('ALTER TABLE "RegenerationJob" ADD COLUMN IF NOT EXISTS "retryIntentId" TEXT NULL')
    await prisma.$executeRawUnsafe('ALTER TABLE "MockExamAttempt" ADD COLUMN IF NOT EXISTS "cohortCount" INTEGER')
  } catch {
    // Try SQLite-compatible ALTER (will throw if unsupported) — ignore errors
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN lockedAt TEXT')
      await prisma.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN completedAt TEXT')
      await prisma.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN retryOfJobId TEXT')
      await prisma.$executeRawUnsafe('ALTER TABLE RegenerationJob ADD COLUMN retryIntentId TEXT')
    } catch {
      // ignore — some test DB setups (managed CI) may not allow schema changes here
    }
  } finally {
    // Clear prepared plans which can cause Postgres "cached plan must not change result type"
    try {
      await prisma.$executeRawUnsafe('DISCARD ALL')
    } catch {
      // ignore if DB doesn't support
    }
    try { await prisma.$disconnect() } catch {}
  }
}

// Run async but do not block test runner if it errors — tests will surface DB schema issues.
void ensureColumns()
