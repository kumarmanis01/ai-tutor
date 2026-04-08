/**
 * Monthly Misconception Prevalence Worker
 * - Computes prevalence_rate for each Misconception over the past 30 days.
 * - prevalenceRate = distinct_students_with_detection / total_answer_attempts_for_concept
 * - Writes `misconception.prevalenceRate` (fraction 0..1)
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'

export async function runMonthlyMisconceptionPrevalence(): Promise<{ updated: number }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days

  try {
    const misconceptions = await prisma.misconception.findMany({ select: { id: true, conceptId: true } })
    let updated = 0

    for (const m of misconceptions) {
      // Count distinct students who had this misconception detected in the window
      const detectionCountRow = await prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*)::bigint AS cnt
        FROM "StudentMisconception"
        WHERE "misconceptionId" = ${m.id}
          AND "lastSeenAt" >= ${since}
      `
      const detectionCount = Number(detectionCountRow[0]?.cnt ?? 0)

      // Total attempts for the concept in the same window
      const attempts = await prisma.answerEvent.count({ where: { conceptId: m.conceptId, createdAt: { gte: since } } })

      const prevalenceRate = attempts > 0 ? detectionCount / attempts : 0

      await prisma.misconception.update({ where: { id: m.id }, data: { prevalenceRate } })
      updated++
    }

    logger.info('misconceptionPrevalence.run.complete', { since: since.toISOString(), count: misconceptions.length })
    return { updated }
  } catch (err) {
    logger.error('misconceptionPrevalence.run.failed', { error: String((err as any)?.message ?? err) })
    return { updated: 0 }
  }
}

export default runMonthlyMisconceptionPrevalence
