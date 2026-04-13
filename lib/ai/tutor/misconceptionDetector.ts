import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface DetectedMisconception {
  misconceptionId: string
  name: string
  correction: string
  confidence: 'HIGH' | 'LOW'
}

type MisconceptionInput = {
  id: string
  name: string
  triggerPatterns: string[]
  correction: string
}

/**
 * Match student input against loaded misconception trigger patterns.
 * Pure function -- no DB calls. Takes pre-loaded misconceptions as input.
 * Returns all matched misconceptions, ordered by confidence desc.
 *
 * @param studentInput - Raw student message text.
 * @param misconceptions - Pre-loaded misconceptions with trigger patterns.
 * @returns Array of detected misconceptions with confidence labels.
 */
export function detectMisconceptions(
  studentInput: string,
  misconceptions: MisconceptionInput[],
): DetectedMisconception[] {
  if (!studentInput || !studentInput.trim() || !Array.isArray(misconceptions) || misconceptions.length === 0) {
    return []
  }

  const text = studentInput.toLowerCase()

  const results: { detected: DetectedMisconception; matchCount: number }[] = []

  for (const m of misconceptions) {
    if (!m || !Array.isArray(m.triggerPatterns) || m.triggerPatterns.length === 0) continue

    let matchCount = 0
    for (const rawPattern of m.triggerPatterns) {
      if (!rawPattern) continue
      const pattern = rawPattern.toLowerCase().trim()
      if (!pattern) continue
      if (text.includes(pattern)) {
        matchCount += 1
      }
    }

    if (matchCount === 0) continue

    const confidence: 'HIGH' | 'LOW' = matchCount >= 2 ? 'HIGH' : 'LOW'

    results.push({
      detected: {
        misconceptionId: m.id,
        name: m.name,
        correction: m.correction,
        confidence,
      },
      matchCount,
    })
  }

  // Order by confidence (HIGH first), then by match count desc, then name for stability.
  results.sort((a, b) => {
    if (a.detected.confidence !== b.detected.confidence) {
      return a.detected.confidence === 'HIGH' ? -1 : 1
    }
    if (b.matchCount !== a.matchCount) {
      return b.matchCount - a.matchCount
    }
    return a.detected.name.localeCompare(b.detected.name)
  })

  return results.map((r) => r.detected)
}

type LoadedMisconception = {
  id: string
  name: string
  triggerPatterns: string[]
  correction: string
  description?: string
}

/**
 * AC-05 (F-STU-013): Log a novel misconception signal for content team review.
 * Called when the student's input has meaningful content but zero library matches.
 * Uses structured JSON logging so the signal is queryable from server logs.
 * Never throws -- analytics must not disrupt the tutor turn.
 *
 * @param studentId - The student whose input produced no match.
 * @param subjectId - Subject being studied.
 * @param conceptId - Concept being studied.
 * @param studentInput - The raw (already redacted) student input.
 */
export function logNovelMisconception(
  studentId: string,
  subjectId: string,
  conceptId: string,
  studentInput: string,
): void {
  try {
    logger.info('misconception.novel_detected', {
      event: 'misconception.novel_detected',
      context: { studentId, subjectId, conceptId },
      // Trim to 200 chars -- enough for content review, avoids log bloat.
      inputSnippet: studentInput.slice(0, 200),
    })
  } catch {
    // never throw from analytics path
  }
}

const misconceptionCache = new Map<string, LoadedMisconception[]>()

/**
 * Load misconceptions for a subject+concept from DB.
 * Cache result in module-level Map for session duration.
 * Returns [] on any DB error -- never throws.
 *
 * @param subjectId - Subject identifier.
 * @param conceptId - Concept identifier.
 * @returns Array of misconceptions for this subject+concept.
 */
export async function loadMisconceptions(
  subjectId: string,
  conceptId: string,
): Promise<LoadedMisconception[]> {
  if (!subjectId || !conceptId) return []

  const key = `${subjectId}:${conceptId}`
  if (misconceptionCache.has(key)) {
    return misconceptionCache.get(key) ?? []
  }

  try {
    const rows = await prisma.misconception.findMany({
      where: { subjectId, conceptId },
      select: {
        id: true,
        name: true,
        triggerPatterns: true,
        correction: true,
        description: true,
      },
    })

    misconceptionCache.set(key, rows)
    return rows
  } catch (err) {
    logger.warn('misconception.load.failed', {
      subjectId,
      conceptId,
      error: String((err as any)?.message ?? err),
    })
    misconceptionCache.set(key, [])
    return []
  }
}

