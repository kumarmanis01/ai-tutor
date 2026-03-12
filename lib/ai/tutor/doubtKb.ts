import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

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
 * already exists for this studentId + conceptId — skip insert, return existing.
 * Normalisation: lowercase, collapse whitespace, strip punctuation.
 * Never throws — returns null on any DB error.
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

