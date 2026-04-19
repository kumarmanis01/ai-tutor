/**
 * FILE OBJECTIVE:
 * - One-shot backfill: re-tags CurriculumChunk rows that have stale positional tag strings
 *   (e.g. ["chapter:N", "chunkIndex:I", "source:ncert"]) instead of canonical Concept UUIDs.
 *   Safe to run multiple times -- skips chunks already tagged with real UUIDs (cuid format).
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/backfill-concept-ids.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-14T00:00:00Z | copilot | created
 *
 * Usage:
 *   npx tsx scripts/backfill-concept-ids.ts [--dry-run]
 *
 * Env required: DATABASE_URL
 */

import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma'

const CUID_RE = /^c[a-z0-9]{24}$/i

/** Returns true if every entry in the array looks like a real cuid (not a tag string). */
function allConceptUuids(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => CUID_RE.test(id))
}

/**
 * Parses the chapter number stored in the legacy positional-tag array.
 * The old format stored tags like ["chapter:3", "chunkIndex:5", "source:ncert", "lang:en"].
 * Returns null if no chapter tag is found.
 */
function extractChapterFromLegacyTags(conceptIds: string[]): number | null {
  for (const tag of conceptIds) {
    const m = tag.match(/^chapter:(\d+)$/)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

/**
 * Resolves Concept UUIDs for a chunk identified by board+subject+grade+chapterOrder.
 * Returns [] when the taxonomy rows don't exist yet.
 */
async function resolveConceptIds(
  prismaClient: PrismaClient,
  board: string,
  subject: string,
  grade: number,
  chapterOrder: number,
): Promise<string[]> {
  const boardRow = await prismaClient.board.findFirst({
    where: { slug: board.toLowerCase() },
    select: { id: true },
  })
  if (!boardRow) return []

  const classLevel = await prismaClient.classLevel.findFirst({
    where: { boardId: boardRow.id, grade },
    select: { id: true },
  })
  if (!classLevel) return []

  const subjectDef = await prismaClient.subjectDef.findFirst({
    where: { classId: classLevel.id, slug: subject },
    select: { id: true },
  })
  if (!subjectDef) return []

  const chapterDef = await prismaClient.chapterDef.findFirst({
    where: { subjectId: subjectDef.id, order: chapterOrder },
    select: { id: true },
  })
  if (!chapterDef) return []

  const concepts = await prismaClient.concept.findMany({
    where: {
      topic: { chapterId: chapterDef.id },
      isSuspended: false,
    },
    select: { id: true },
  })
  return concepts.map((c) => c.id)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[backfill-concept-ids] DRY RUN -- no writes will be performed.')

  // Use shared singleton Prisma client from lib/prisma
  let updated = 0
  let skipped = 0
  let noConceptsFound = 0
  let errors = 0

  try {
    // Fetch all chunks with at least one tag to inspect.
    // We only need to reprocess chunks where conceptIds contains legacy strings (not UUIDs).
    const chunks = await prisma.$queryRawUnsafe<
      { id: string; board: string | null; subject: string | null; grade: string | null; conceptIds: string[] }[]
    >(`SELECT id, board, subject, grade, "conceptIds" FROM "CurriculumChunk"`)

    console.log(`[backfill-concept-ids] Processing ${chunks.length} total chunk(s) ...`)

    for (const chunk of chunks) {
      // Skip chunks already tagged with real concept UUIDs
      if (allConceptUuids(chunk.conceptIds)) {
        skipped++
        continue
      }

      // Extract chapter number from stale positional tags
      const chapterOrder = extractChapterFromLegacyTags(chunk.conceptIds)
      if (chapterOrder === null || !chunk.board || !chunk.subject || !chunk.grade) {
        skipped++
        continue
      }

      const grade = parseInt(chunk.grade, 10)
      if (isNaN(grade)) { skipped++; continue }

      let conceptIds: string[]
      try {
        conceptIds = await resolveConceptIds(prisma, chunk.board, chunk.subject, grade, chapterOrder)
      } catch (err) {
        console.error(`[backfill-concept-ids] resolveConceptIds error for chunk ${chunk.id}:`, err)
        errors++
        continue
      }

      if (conceptIds.length === 0) {
        // Concepts not yet seeded for this chapter -- store empty array (correct) rather than stale strings
        noConceptsFound++
      }

      if (!dryRun) {
        try {
          await prisma.curriculumChunk.update({
            where: { id: chunk.id },
            data: { conceptIds },
          })
          updated++
        } catch (err) {
          console.error(`[backfill-concept-ids] Update failed for chunk ${chunk.id}:`, err)
          errors++
        }
      } else {
        console.log(
          `[backfill-concept-ids] (dry-run) Would update chunk ${chunk.id}: ` +
          `chapter=${chapterOrder} -> ${conceptIds.length} concept UUID(s)`,
        )
        updated++
      }
    }

    console.log(
      `[backfill-concept-ids] Done. updated=${updated} skipped=${skipped} ` +
      `noConceptsFound=${noConceptsFound} errors=${errors}`,
    )
    if (noConceptsFound > 0) {
      console.warn(
        `[backfill-concept-ids] ${noConceptsFound} chunk(s) have no concepts in taxonomy yet. ` +
        `These chunks will remain untagged and won't be returned by RAG until concepts are seeded. ` +
        `Re-run this script after seeding concept taxonomy.`,
      )
    }
  } finally {
    await prisma.$disconnect()
  }

  if (errors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[backfill-concept-ids] Fatal:', err?.message ?? err)
  process.exit(1)
})
