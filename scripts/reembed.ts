#!/usr/bin/env -S npx tsx
/**
 * FILE OBJECTIVE:
 * - Admin utility to re-embed failed CurriculumChunk rows reported in an IngestRunLog
 *   or by explicit chunk id list. Idempotent and safe to re-run.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/reembed.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-14T00:00:00Z | copilot | created reembed CLI to retry failed embeddings
 */

import { PrismaClient } from '@prisma/client'
import { getEmbeddingsBatch } from '../lib/ai/embeddings'

const BATCH_SIZE = 20

function parseArgs() {
  const argv = process.argv.slice(2)
  const args: any = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--run-id') { args.runId = argv[i + 1]; i++ }
    else if (a === '--chunk-ids') { args.chunkIds = argv[i + 1]; i++ }
    else if (a === '--dry-run') { args.dryRun = true }
  }
  return args
}

export async function main() {
  const args = parseArgs()
  if (!args.runId && !args.chunkIds) {
    console.error('Usage: npx tsx scripts/reembed.ts --run-id <id> | --chunk-ids id1,id2 [--dry-run]')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  const startMs = Date.now()

  try {
    let chunkIds: string[] = []

    if (args.runId) {
      const run = await prisma.ingestRunLog.findUnique({ where: { id: args.runId }, select: { id: true, errorDetails: true } })
      if (!run) {
        console.error(`Run ${args.runId} not found`)
        process.exit(1)
      }
      const details = run.errorDetails as any
      if (!details || !Array.isArray(details) || details.length === 0) {
        console.error(`Run ${args.runId} has no errorDetails to retry`)
        process.exit(1)
      }
      chunkIds = details.map((d: any) => d.id).filter(Boolean)
    } else if (args.chunkIds) {
      chunkIds = String(args.chunkIds).split(',').map((s) => s.trim()).filter(Boolean)
    }

    if (chunkIds.length === 0) {
      console.log('No chunk ids to re-embed')
      return
    }

    console.log(`Re-embedding ${chunkIds.length} chunk(s)...`)

    // Fetch contents for chunks
    const rows = await prisma.curriculumChunk.findMany({ where: { id: { in: chunkIds } }, select: { id: true, content: true } })
    const toEmbed = rows.filter((r) => r.content).map((r) => ({ id: r.id, content: r.content as string }))

    if (toEmbed.length === 0) {
      console.log('No available content for the requested chunk ids')
      return
    }

    if (args.dryRun) {
      console.log(`DRY RUN: Would attempt to re-embed ${toEmbed.length} chunk(s).`)
      return
    }

    let embedded = 0
    let errors = 0
    const errorDetails: { id: string; error: string }[] = []

    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE)
      const embeddings = await getEmbeddingsBatch(batch.map((b) => b.content), BATCH_SIZE)

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j]
        const embedding = embeddings[j]
        if (!embedding) {
          console.error(`✗ embedding failed for chunk ${item.id}`)
          errors++
          errorDetails.push({ id: item.id, error: 'embedding_failed' })
          continue
        }

        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "CurriculumChunk" SET embedding = $1::vector, "updatedAt" = NOW() WHERE id = $2`,
            `[${embedding.join(',')}]`,
            item.id,
          )
          embedded++
        } catch (err) {
          console.error(`✗ DB error writing embedding for chunk ${item.id}:`, err)
          errors++
          errorDetails.push({ id: item.id, error: String(err) })
        }
      }
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length}`)
    }

    console.log(`Done. Embedded: ${embedded}, Failed: ${errors}`)

    // Record a run log for this re-embed operation
    try {
      const duration = Date.now() - startMs
      const created = await prisma.ingestRunLog.create({
        data: {
          fileSource: `reembed-cli`,
          board: 'cli',
          chunksCreated: 0,
          chunksUpdated: embedded,
          embeddingsGenerated: embedded,
          errors,
          durationMs: duration,
          errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        },
      })

      // Analytics event for ops visibility
      try {
        await prisma.analyticsEvent.create({
          data: {
            eventType: 'ingest_run_retry',
            userId: null,
            courseId: null,
            lessonIdx: null,
            metadata: {
              sourceRunId: args.runId ?? null,
              reembedded: embedded,
              errors,
              reembedRunId: created.id,
            },
          },
        })
      } catch (ae) {
        console.warn('Could not write analyticsEvent for reembed run:', ae)
      }
    } catch (e) {
      console.warn('Could not write ingestRunLog for reembed run:', e)
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (typeof process !== 'undefined' && process.env.JEST_WORKER_ID === undefined) {
  main().catch((err) => {
    console.error('Fatal reembed error:', err?.message ?? err)
    process.exit(1)
  })
}
