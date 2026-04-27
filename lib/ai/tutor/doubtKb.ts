import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getEmbedding } from '@/lib/ai/embeddings'
import client from 'prom-client'

// Metrics for DoubtKb cache hit/miss monitoring (registered to global registry)
export const doubtKbLookupTotal = new client.Counter({
  name: 'doubtkb_lookup_total',
  help: 'Total DoubtKb lookup attempts',
  registers: [client.register],
})
export const doubtKbLookupHit = new client.Counter({
  name: 'doubtkb_lookup_hit_total',
  help: 'DoubtKb lookup cache hits',
  registers: [client.register],
})
export const doubtKbLookupMiss = new client.Counter({
  name: 'doubtkb_lookup_miss_total',
  help: 'DoubtKb lookup cache misses',
  registers: [client.register],
})

function normalizeQuestion(q: string): string {
  return (q ?? '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function jaccardSimilarity(a: string, b: string): number {
  const aa = normalizeQuestion(a)
  const bb = normalizeQuestion(b)
  if (!aa && !bb) return 1
  if (!aa || !bb) return 0

  const setA = new Set(aa.split(' ').filter(Boolean))
  const setB = new Set(bb.split(' ').filter(Boolean))
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const w of setA) {
    if (setB.has(w)) intersection += 1
  }
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

/**
 * Save a student doubt + Vidya's answer to the KB.
 * Dedup check: if an identical question (exact string match after normalisation)
 * already exists for this studentId + conceptId -- skip insert, return existing.
 * Normalisation: lowercase, collapse whitespace, strip punctuation.
 * Never throws -- returns null on any DB error.
 */
export async function saveDoubt(params: {
  studentId: string
  sessionId: string
  conceptId: string
  question: string
  answer: string
}): Promise<{ id: string; isDuplicate: boolean } | null> {
  const { studentId, sessionId, conceptId, question, answer } = params
  const normalizedIncoming = normalizeQuestion(question)
  if (!studentId || !sessionId || !conceptId) return null
  if (!normalizedIncoming) return null

  try {
    const existing = await prisma.doubtKb.findMany({
      where: { studentId, conceptId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, question: true },
    })

    for (const row of existing) {
      const normalizedExisting = normalizeQuestion(row.question)
      if (normalizedExisting === normalizedIncoming) {
        return { id: row.id, isDuplicate: true }
      }
      const sim = jaccardSimilarity(normalizedIncoming, normalizedExisting)
      if (sim >= 0.88) {
        return { id: row.id, isDuplicate: true }
      }
    }

    const created = await prisma.doubtKb.create({
      data: {
        studentId,
        sessionId,
        conceptId,
        question,
        answer,
      },
      select: { id: true },
    })

    return { id: created.id, isDuplicate: false }
  } catch (err) {
    logger.warn('[doubtKb] saveDoubt failed', {
      studentId,
      conceptId,
      error: String((err as any)?.message ?? err),
    })
    return null
  }
}

// ── T26: pgvector-based shared DoubtKb functions ──────────────────────────────

const LOOKUP_THRESHOLD = 0.92 // cosine similarity for cache hit
const DEDUP_THRESHOLD = 0.88  // cosine similarity for near-duplicate detection

/**
 * Look up a cached answer for this question using pgvector cosine similarity.
 * Threshold: 0.92. On hit, increments timesServed and returns answerText.
 * Never throws -- returns null on embedding failure or any error.
 */
export async function lookupDoubt(
  questionText: string,
  subjectId: string,
): Promise<string | null> {
  if (!questionText?.trim() || !subjectId) return null
  try {
    doubtKbLookupTotal.inc()
    const vec = await getEmbedding(questionText)
    if (!vec) return null

    const embeddingLiteral = `[${vec.join(',')}]`

    type Row = { id: string; answerText: string; similarity: number }
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT id, "answerText", 1 - (embedding <=> $1::vector) AS similarity
      FROM "DoubtKb"
      WHERE "subjectId" = $2
        AND embedding IS NOT NULL
          AND "answerText" IS NOT NULL
          AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY similarity DESC
      LIMIT 1
      `,
      embeddingLiteral,
      subjectId,
      LOOKUP_THRESHOLD,
    )) as Row[]

    if (!rows.length) {
      doubtKbLookupMiss.inc()
      return null
    }

    // Increment timesServed (fire-and-forget)
    prisma.doubtKb.update({
      where: { id: rows[0].id },
      data: { timesServed: { increment: 1 } },
    }).catch(() => {})

    doubtKbLookupHit.inc()

    return rows[0].answerText
  } catch (err) {
    logger.warn('[doubtKb] lookupDoubt failed', {
      error: String((err as any)?.message ?? err),
    })
    return null
  }
}

/**
 * Record a novel doubt into the shared KB, or update an existing near-duplicate.
 *
 * - Similarity >= 0.88 → update timesServed++, append to alternatePhrasings
 * - Novel (< 0.88)     → create new row with embedding
 *
 * Never throws. Call fire-and-forget: `recordDoubt(...).catch(() => {})`
 */
export async function recordDoubt(
  questionText: string,
  answerText: string,
  subjectId: string,
  conceptId?: string,
): Promise<void> {
  if (!questionText?.trim() || !answerText?.trim() || !subjectId) return
  try {
    const vec = await getEmbedding(questionText)
    if (!vec) return

    const embeddingLiteral = `[${vec.join(',')}]`

    type Row = { id: string; alternatePhrasings: string[] }
    const existing = (await prisma.$queryRawUnsafe(
      `
      SELECT id, "alternatePhrasings", 1 - (embedding <=> $1::vector) AS similarity
      FROM "DoubtKb"
      WHERE "subjectId" = $2
        AND embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY similarity DESC
      LIMIT 1
      `,
      embeddingLiteral,
      subjectId,
      DEDUP_THRESHOLD,
    )) as Row[]

    if (existing.length > 0) {
      const row = existing[0]
      const newPhrasings = [...(row.alternatePhrasings ?? []), questionText].slice(-10)
      await prisma.$executeRawUnsafe(
        `UPDATE "DoubtKb"
         SET "timesServed" = "timesServed" + 1,
             "alternatePhrasings" = $1::text[],
             "updatedAt" = NOW()
         WHERE id = $2`,
        newPhrasings,
        row.id,
      )
    } else {
      // Novel doubt -- create new row
      await prisma.doubtKb.create({
        data: {
          // legacy fields kept for compatibility
          studentId: 'shared',
          sessionId: 'shared',
          question: questionText,
          answer: answerText,
          // T26 fields
          subjectId,
          conceptId: conceptId ?? null,
          questionText,
          answerText,
        },
      })
      // Write embedding in a separate raw update (Prisma doesn't support Unsupported on create)
      await prisma.$executeRawUnsafe(
        `UPDATE "DoubtKb" SET embedding = $1::vector WHERE "questionText" = $2 AND "subjectId" = $3 AND embedding IS NULL`,
        embeddingLiteral,
        questionText,
        subjectId,
      )
    }
  } catch (err) {
    logger.warn('[doubtKb] recordDoubt failed', {
      error: String((err as any)?.message ?? err),
    })
  }
}

/**
 * Retrieve recent doubts for a student+concept.
 * Used to surface "previously asked" context in prompt assembly.
 * Returns [] on error. Limit 5, ordered by createdAt desc.
 */
export async function getRecentDoubts(
  studentId: string,
  conceptId: string,
): Promise<Array<{ question: string; answer: string; createdAt: Date }>> {
  try {
    if (!studentId || !conceptId) return []
    return await prisma.doubtKb.findMany({
      where: { studentId, conceptId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { question: true, answer: true, createdAt: true },
    })
  } catch (err) {
    logger.warn('[doubtKb] getRecentDoubts failed', {
      studentId,
      conceptId,
      error: String((err as any)?.message ?? err),
    })
    return []
  }
}

