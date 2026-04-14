/**
 * Integration test: run `scripts/ingest-curriculum.ts` multiple times against
 * the test database to verify idempotency and version bump behavior.
 *
 * Uses Jest integration config which prepares Prisma and test DB.
 */
import path from 'path'
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

// This script may run embedding-generation and other DB work; increase timeout.
jest.setTimeout(180_000)

const prisma = new PrismaClient()

describe('ingest-curriculum integration', () => {
  beforeAll(async () => {
    // Ensure minimal schema exists so tests can run without full migrations
    // Create a simple DOMAIN `vector` as text so the ingest script's `$1::vector`
    // casts succeed even when pgvector isn't installed in the test DB.
    try {
      await prisma.$executeRawUnsafe(`CREATE DOMAIN IF NOT EXISTS vector AS text`)
    } catch (err) {
      // Some Postgres versions or managed DBs may not support `CREATE DOMAIN IF NOT EXISTS`.
      // This is non-fatal for the test; continue if the statement fails.
    }

    // Create CurriculumChunk table if missing (minimal columns used by script)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CurriculumChunk" (
        id TEXT PRIMARY KEY,
        content TEXT,
        "contentHash" TEXT,
        version INT DEFAULT 1,
        embedding vector,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
      )
    `)

    // Create IngestRunLog table if missing (minimal columns written by script)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IngestRunLog" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "runAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "fileSource" TEXT,
        "board" TEXT,
        "subjectId" TEXT,
        "chunksCreated" INT DEFAULT 0,
        "chunksUpdated" INT DEFAULT 0,
        "embeddingsGenerated" INT DEFAULT 0,
        "errors" INT DEFAULT 0,
        "durationMs" INT,
        "errorDetails" JSONB
      )
    `)

    // Clean relevant tables to start from known state
    await prisma.ingestRunLog.deleteMany({})
    await prisma.curriculumChunk.deleteMany({})
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('re-running ingest is idempotent and bumps version on content change', async () => {
    // Create a chunk with null contentHash to simulate new row
    const chunk = await prisma.curriculumChunk.create({
      data: {
        content: 'original content',
        board: 'CBSE',
        subject: 'science',
        grade: '10',
        contentHash: null,
        version: 1,
      },
    })

    const scriptPath = path.join(process.cwd(), 'scripts', 'ingest-curriculum.ts')

    // First run: should write hash / embedding (embedding may be mocked in CI)
    execSync(`node ${scriptPath}`, { stdio: 'pipe', env: process.env })

    const afterFirst = await prisma.curriculumChunk.findUnique({ where: { id: chunk.id } })
    expect(afterFirst).not.toBeNull()
    const firstHash = afterFirst!.contentHash
    expect(firstHash).toBeTruthy()

    // Second run without changes: should not bump version or change hash
    execSync(`node ${scriptPath}`, { stdio: 'pipe', env: process.env })
    const afterSecond = await prisma.curriculumChunk.findUnique({ where: { id: chunk.id } })
    expect(afterSecond).not.toBeNull()
    expect(afterSecond!.contentHash).toBe(firstHash)
    expect(afterSecond!.version).toBe(afterFirst!.version)

    // Update content and run: version must increment and hash change
    await prisma.curriculumChunk.update({ where: { id: chunk.id }, data: { content: 'modified content' } })
    execSync(`node ${scriptPath}`, { stdio: 'pipe', env: process.env })
    const afterThird = await prisma.curriculumChunk.findUnique({ where: { id: chunk.id } })
    expect(afterThird).not.toBeNull()
    expect(afterThird!.contentHash).not.toBe(firstHash)
    expect(afterThird!.version).toBeGreaterThan(afterSecond!.version)

    // Confirm ingest run logs were written
    const logs = await prisma.ingestRunLog.findMany({ orderBy: { runAt: 'asc' } })
    expect(logs.length).toBeGreaterThanOrEqual(3)
  }, 120_000)
})
