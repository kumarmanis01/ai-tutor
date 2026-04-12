/**
 * Integration test: verify IVFFLAT index exists for DoubtKb and measure
 * retrieval latency under a small synthetic load.
 *
 * This test only runs when the `vector` extension (pgvector) is present in
 * the test database. If pgvector is missing the test is skipped.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function randomVectorLiteral(dim: number) {
  const values = Array.from({ length: dim }, () => (Math.random() * 2 - 1).toFixed(6))
  return `[${values.join(',')}]`
}

describe('DoubtKb IVFFLAT index and latency', () => {
  beforeAll(async () => {
    // No-op: tests will create minimal artifacts as needed.
  })

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "DoubtKb" WHERE "subjectId" = 'integration-test-subject'`).catch(() => {})
    await prisma.$disconnect()
  })

  test('IVFFLAT index exists when pgvector is installed and retrieval is fast', async () => {
    // Check for pgvector extension presence
    const hasVectorExtRows: any[] = await prisma.$queryRawUnsafe(`SELECT extname FROM pg_extension WHERE extname = 'vector'`)
    if (!hasVectorExtRows || hasVectorExtRows.length === 0) {
      console.warn('pgvector extension not installed in DB; skipping IVFFLAT/index latency assertions')
      return
    }

    // Ensure minimal DoubtKb table exists with embedding column
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DoubtKb" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "subjectId" TEXT,
        embedding vector(1536)
      )
    `)

    // Confirm IVFFLAT index exists
    const idxRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'DoubtKb' AND indexdef LIKE '%USING ivfflat%'
    `)
    expect(idxRows.length).toBeGreaterThanOrEqual(1)

    // Seed a modest number of synthetic vectors for a small latency check
    const DIM = 1536
    const ROWS = 200
    const subject = 'integration-test-subject'

    const values: string[] = []
    for (let i = 0; i < ROWS; i++) {
      const v = randomVectorLiteral(DIM)
      values.push(`(gen_random_uuid(), '${subject}', '${v}')`)
    }

    // Insert in one statement for speed. Use $executeRawUnsafe because Prisma
    // does not support vector typed literals directly.
    const insertSql = `INSERT INTO "DoubtKb" (id, "subjectId", embedding) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`
    await prisma.$executeRawUnsafe(insertSql)

    // Run several similarity queries and measure average time
    const QUERIES = 20
    const queryVector = randomVectorLiteral(DIM)
    const times: number[] = []

    for (let q = 0; q < QUERIES; q++) {
      const start = Date.now()
      await prisma.$queryRawUnsafe(`
        SELECT id, 1 - (embedding <=> $1::vector) AS similarity
        FROM "DoubtKb"
        WHERE "subjectId" = $2 AND embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 1
      `, queryVector, subject)
      times.push(Date.now() - start)
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length
    // Expect average retrieval latency to be reasonable under test infra.
    // Use conservative threshold to avoid brittle failures in CI/staging.
    const THRESHOLD_MS = 200
    expect(avg).toBeLessThanOrEqual(THRESHOLD_MS)
  }, 180_000)
})
