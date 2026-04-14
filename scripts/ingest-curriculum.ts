/**
 * FILE OBJECTIVE:
 * - Idempotent curriculum chunk ingestion: embed CurriculumChunk rows and bump version when content changes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/ingest-curriculum.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | git-user | refactor for dependency-injection, add tests, remove debug logs
 * - 2026-04-14T00:00:00Z | copilot | write contentHash even when embedding fails for idempotency correctness
 */

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma.js'
import { getEmbeddingsBatch } from '../lib/ai/embeddings'
const BATCH_SIZE = 20

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export async function main(prismaClient = prisma) {
  const args = process.argv.slice(2)
  const retryFailed = args.includes('--retry-failed')
  const runIdIdx = args.indexOf('--run-id')
  const _runId = runIdIdx !== -1 ? args[runIdIdx + 1] : null

  console.log('[ingest] Starting curriculum chunk ingestion v2...')
  const startMs = Date.now()

  // Fetch all chunks (we'll do hash comparison in-process)
  const _chunks = await prismaClient.$queryRawUnsafe(
    `
      SELECT id, content, "contentHash", version
      FROM "CurriculumChunk"
      ORDER BY "createdAt" ASC
    `,
  )
  const chunks = (_chunks ?? []) as { id: string; content: string | null; contentHash: string | null; version: number }[]

  if (chunks.length === 0) {
    console.log('[ingest] No chunks found. Nothing to do.')
    await prismaClient.$disconnect()
    return
  }

  // Determine which chunks need embedding (embedding IS NULL)
  const _chunksNeedingEmbed = await prismaClient.$queryRawUnsafe(
    `
      SELECT id, content, "contentHash", version
      FROM "CurriculumChunk"
      WHERE embedding IS NULL
      ORDER BY "createdAt" ASC
    `,
  )
  const chunksNeedingEmbed = (_chunksNeedingEmbed ?? []) as { id: string; content: string | null; contentHash: string | null; version: number }[]

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
    await writeRunLog({ chunksCreated: 0, chunksUpdated: 0, embeddingsGenerated: 0, errors: 0, startMs, _prismaClient: prismaClient })
    await prismaClient.$disconnect()
    return
  }

  console.log(`[ingest] Found ${toProcess.length} chunks to embed (${toProcess.filter((c) => c.needsVersionBump).length} with content changes).`)
  // production log only

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
        // Persist the content hash even when embedding fails so idempotency
        // works on subsequent runs. The chunk stays in chunksNeedingEmbed (NULL embedding)
        // and the next run will retry the embed without treating the content as "changed".
        try {
          if (chunk.needsVersionBump) {
            await prismaClient.$executeRawUnsafe(
              `UPDATE "CurriculumChunk" SET "contentHash" = $1, version = version + 1, "updatedAt" = NOW() WHERE id = $2`,
              chunk.newHash,
              chunk.id,
            )
            chunksUpdated++
          } else {
            await prismaClient.$executeRawUnsafe(
              `UPDATE "CurriculumChunk" SET "contentHash" = $1, "updatedAt" = NOW() WHERE id = $2`,
              chunk.newHash,
              chunk.id,
            )
          }
        } catch (hashErr) {
          // Non-fatal: hash write failed on top of embedding failure
        }
        console.error(`[ingest] ✗ Failed to embed chunk ${chunk.id}`)
        errors++
        errorDetails.push({ id: chunk.id, error: 'embedding_failed' })
        continue
      }

      const vectorLiteral = `[${embedding.join(',')}]`
      try {
        if (chunk.needsVersionBump) {
          // Bump version + update hash + embedding
          await prismaClient.$executeRawUnsafe(
            `UPDATE "CurriculumChunk"
             SET embedding = $1::vector, "contentHash" = $2, version = version + 1, "updatedAt" = NOW()
             WHERE id = $3`,
            vectorLiteral,
            chunk.newHash,
            chunk.id,
          )
        } else {
          // First-time embed -- set hash + embedding
          await prismaClient.$executeRawUnsafe(
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
    _prismaClient: prismaClient,
  })
  await prismaClient.$disconnect()

  if (errors > 0 && typeof process !== 'undefined' && process.env.JEST_WORKER_ID === undefined) process.exit(1)
}

export async function writeRunLog(opts: {
  chunksCreated: number
  chunksUpdated: number
  embeddingsGenerated: number
  errors: number
  startMs: number
  fileSource?: string
  errorDetails?: unknown
  _prismaClient?: any
}) {
  try {
    const client = (opts as any)._prismaClient ?? prisma
    await client.ingestRunLog.create({
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

// Only execute when not running under Jest (tests import this module)
if (typeof process !== 'undefined' && process.env.JEST_WORKER_ID === undefined) {
  main().catch((err) => {
    console.error('[ingest] Fatal error:', err)
    try { void prisma.$disconnect() } catch {}
    process.exit(1)
  })
}
