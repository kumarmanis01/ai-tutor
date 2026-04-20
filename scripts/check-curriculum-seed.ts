/**
 * FILE OBJECTIVE:
 * - Small CLI to verify CurriculumChunk counts for a given board and grade
 *   (useful for launch verification and seed checks against Neon).
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/check-curriculum-seed.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-20T00:00:00Z | copilot | created script to check curriculum chunk counts
 * - 2026-04-21T00:00:00Z | copilot | made script testable (export helpers + guard main); updated usage text
 */

import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'

export function getFlag(name: string) {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

export async function main() {
  const board = getFlag('--board') || getFlag('-b')
  const grade = getFlag('--grade') || getFlag('-g')
  const subjectsRaw = getFlag('--subjects') || getFlag('-s')
  const expectedRaw = getFlag('--expected')

  if (!board || !grade) {
    console.error('Usage: npx tsx scripts/check-curriculum-seed.ts --board CBSE --grade 10 [--subjects math,science] [--expected 100]')
    console.error('Or: npm run check-curriculum-seed (if provided)')
    process.exit(2)
  }

  const subjects = subjectsRaw ? subjectsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  const expected = expectedRaw ? Number(expectedRaw) : undefined

  logger.info('check-curriculum-seed starting', { board, grade, subjects })

  if (subjects && subjects.length > 0) {
    for (const subject of subjects) {
      const cnt = await prisma.curriculumChunk.count({ where: { board: String(board), grade: String(grade), subject: subject } })
      console.log(`${board} grade ${grade} subject=${subject} → ${cnt} chunks`)
    }
  } else {
    // Group counts by subject for the provided board+grade
    const rows = await prisma.curriculumChunk.groupBy({
      by: ['subject'],
      where: { board: String(board), grade: String(grade) },
      _count: { id: true },
    })

    const total = rows.reduce((s, r) => s + (r._count.id ?? 0), 0)
    console.log(`${board} grade ${grade} → total chunks: ${total}`)
    for (const r of rows) {
      console.log(`  ${r.subject ?? '<no-subject>'}: ${r._count.id}`)
    }

    if (typeof expected === 'number') {
      if (total < expected) {
        console.error(`ERROR: total ${total} < expected ${expected}`)
        process.exit(3)
      }
      console.log(`OK: total ${total} >= expected ${expected}`)
    }
  }

  await prisma.$disconnect()
}

// Run main only when executed directly (not when imported by tests)
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err) => {
    logger.error('check-curriculum-seed failed', { err: String(err) })
    process.exit(1)
  })
}
