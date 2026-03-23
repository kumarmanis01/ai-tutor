/**
 * Ingestion pipeline v2 -- embeds CurriculumChunk rows, skipping unchanged content.
 * Content-hash idempotency: re-embeds only if content changed (version bumped).
 * Writes an IngestRunLog entry on completion.
 *
 * Usage:
 *   DATABASE_URL=<neon-url> OPENAI_API_KEY=<key> npx tsx scripts/ingest-curriculum.ts
 *   DATABASE_URL=<neon-url> OPENAI_API_KEY=<key> npx tsx scripts/ingest-curriculum.ts --retry-failed --run-id <id>
 */

import { createHash } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { getEmbeddingsBatch } from '../lib/ai/embeddings'

const prisma = new PrismaClient()
const BATCH_SIZE = 20

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function main() {
  const args = process.argv.slice(2)
  const retryFailed = args.includes('--retry-failed')
  const runIdIdx = args.indexOf('--run-id')
  const _runId = runIdIdx !== -1 ? args[runIdIdx + 1] : null

  console.log('[ingest] Starting curriculum chunk ingestion v2...')
  const startMs = Date.now()

  // Fetch all chunks (we'll do hash comparison in-process)
  const chunks = (await prisma.$queryRawUnsafe(
    `
      SELECT id, content, "contentHash", version
      FROM "CurriculumChunk"
      ORDER BY "createdAt" ASC
    `,
  )) as { id: string; content: string | null; contentHash: string | null; version: number }[]

  if (chunks.length === 0) {
    console.log('[ingest] No chunks found. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // Determine which chunks need embedding:
  // - No contentHash (never ingested)
  // - contentHash changed (content was updated)
  // - No embedding (embedding IS NULL)
  const chunksNeedingEmbed = (await prisma.$queryRawUnsafe(
    `
      SELECT id, content, "contentHash", version
      FROM "CurriculumChunk"
      WHERE embedding IS NULL
      ORDER BY "createdAt" ASC
    `,
  )) as { id: string; content: string | null; contentHash: string | null; version: number }[]

  // Compute hashes and check which need updating
  const toProcess: { id: string; content: string; newHash: string; needsVersionBump: boolean }[] = []

  for (const chunk of chunks) {
    const text = chunk.content ?? ''
    const newHash = sha256(text)

    if (chunk.contentHash !== newHash) {
      // Content changed -- needs re-embed and version bump
      toProcess.push({ id: chunk.id, content: text, newHash, needsVersionBump: chunk.contentHash !== null })
    }
  }

  // Also include any chunks with NULL embedding that aren't already in toProcess
  const toProcessIds = new Set(toProcess.map((c) => c.id))
  for (const chunk of chunksNeedingEmbed) {
    if (!toProcessIds.has(chunk.id)) {
      const text = chunk.content ?? ''
      toProcess.push({ id: chunk.id, content: text, newHash: sha256(text), needsVersionBump: false })
    }
  }

  if (toProcess.length === 0) {
    console.log('[ingest] All chunks already embedded with current content. Nothing to do.')
    await writeRunLog({ chunksCreated: 0, chunksUpdated: 0, embeddingsGenerated: 0, errors: 0, startMs })
    await prisma.$disconnect()
    return
  }

  console.log(`[ingest] Found ${toProcess.length} chunks to embed (${toProcess.filter((c) => c.needsVersionBump).length} with content changes).`)

  let embeddingsGenerated = 0
  let chunksUpdated = 0
  let errors = 0
  const errorDetails: { id: string; error: string }[] = []

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.content)
    const embeddings = await getEmbeddingsBatch(texts, BATCH_SIZE)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const embedding = embeddings[j]

      if (!embedding) {
        console.error(`[ingest] ✗ Failed to embed chunk ${chunk.id}`)
        errors++
        errorDetails.push({ id: chunk.id, error: 'embedding_failed' })
        continue
      }

      const vectorLiteral = `[${embedding.join(',')}]`
      try {
        if (chunk.needsVersionBump) {
          // Bump version + update hash + embedding
          await prisma.$executeRawUnsafe(
            `UPDATE "CurriculumChunk"
             SET embedding = $1::vector, "contentHash" = $2, version = version + 1, "updatedAt" = NOW()
             WHERE id = $3`,
            vectorLiteral,
            chunk.newHash,
            chunk.id,
          )
        } else {
          // First-time embed -- set hash + embedding
          await prisma.$executeRawUnsafe(
            `UPDATE "CurriculumChunk"
             SET embedding = $1::vector, "contentHash" = $2, "updatedAt" = NOW()
             WHERE id = $3`,
            vectorLiteral,
            chunk.newHash,
            chunk.id,
          )
        }
        embeddingsGenerated++
        if (chunk.needsVersionBump) chunksUpdated++
      } catch (err) {
        console.error(`[ingest] ✗ DB error for chunk ${chunk.id}:`, err)
        errors++
        errorDetails.push({ id: chunk.id, error: String(err) })
      }
    }

    console.log(`[ingest] Progress: ${Math.min(i + BATCH_SIZE, toProcess.length)}/${toProcess.length}`)
  }

  console.log(`\n[ingest] Done. Embedded: ${embeddingsGenerated}, Updated: ${chunksUpdated}, Failed: ${errors}`)

  await writeRunLog({
    chunksCreated: embeddingsGenerated - chunksUpdated,
    chunksUpdated,
    embeddingsGenerated,
    errors,
    startMs,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
  })

  await prisma.$disconnect()

  if (errors > 0) process.exit(1)
}

async function writeRunLog(opts: {
  chunksCreated: number
  chunksUpdated: number
  embeddingsGenerated: number
  errors: number
  startMs: number
  fileSource?: string
  errorDetails?: unknown
}) {
  try {
    await prisma.ingestRunLog.create({
      data: {
        chunksCreated: opts.chunksCreated,
        chunksUpdated: opts.chunksUpdated,
        embeddingsGenerated: opts.embeddingsGenerated,
        errors: opts.errors,
        durationMs: Date.now() - opts.startMs,
        fileSource: opts.fileSource ?? 'cli',
        errorDetails: opts.errorDetails ? (opts.errorDetails as object) : undefined,
      },
    })
  } catch (err) {
    console.warn('[ingest] Could not write IngestRunLog:', err)
  }
}

main().catch((err) => {
  console.error('[ingest] Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})
