/**
 * Ingestion pipeline — embeds all CurriculumChunk rows that have no embedding.
 * Safe to re-run (idempotent — skips chunks that already have embeddings).
 *
 * Usage:
 *   DATABASE_URL=<neon-url> OPENAI_API_KEY=<key> npx tsx scripts/ingest-curriculum.ts
 */

import { PrismaClient } from '@prisma/client'
import { getEmbeddingsBatch } from '../lib/ai/embeddings'

const prisma = new PrismaClient()
const BATCH_SIZE = 20

async function main() {
  console.log('[ingest] Starting curriculum chunk ingestion...')

  const chunks = await prisma.curriculumChunk.findMany({
    where: { embedding: null as any },
    select: { id: true, content: true },
    orderBy: { createdAt: 'asc' },
  })

  if (chunks.length === 0) {
    console.log('[ingest] All chunks already embedded. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  console.log(`[ingest] Found ${chunks.length} chunks to embed.`)

  let embedded = 0
  let failed = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.content ?? '')
    const embeddings = await getEmbeddingsBatch(texts, BATCH_SIZE)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const embedding = embeddings[j]

      if (!embedding) {
        // eslint-disable-next-line no-console
        console.error(`[ingest] ✗ Failed to embed chunk ${chunk.id}`)
        failed++
        continue
      }

      const vectorLiteral = `[${embedding.join(',')}]`
      await prisma.$executeRawUnsafe(
        `UPDATE "CurriculumChunk" SET embedding = $1::vector WHERE id = $2`,
        vectorLiteral,
        chunk.id,
      )
      embedded++
    }

    // eslint-disable-next-line no-console
    console.log(`[ingest] Progress: ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`)
  }

  // eslint-disable-next-line no-console
  console.log(`\n[ingest] Done. Embedded: ${embedded}, Failed: ${failed}`)
  await prisma.$disconnect()

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ingest] Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})

