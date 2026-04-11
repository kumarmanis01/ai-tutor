/**
 * Monthly Misconception Prevalence Worker
 * - Computes prevalence_rate for each Misconception over the past 30 days.
 * - prevalenceRate = distinct_students_with_detection / total_answer_attempts_for_concept
 * - Writes `misconception.prevalenceRate` (fraction 0..1)
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'

// System alerts: create or update per-misconception high-prevalence alerts

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

      // Persist prevalenceRate on the Misconception row
      await prisma.misconception.update({ where: { id: m.id }, data: { prevalenceRate } })
      
      // Emit or update a system alert for high prevalence (> 30%) per misconception
      try {
        const THRESHOLD = 0.3
        const mis = await prisma.misconception.findUnique({ where: { id: m.id }, select: { id: true, name: true, conceptId: true, subjectId: true } })
        if (mis) {
          const message = `High prevalence: Misconception ${mis.name} (${mis.id}) prevalence=${(prevalenceRate * 100).toFixed(1)}%`
          if (prevalenceRate > THRESHOLD) {
            // Update existing alert with same message or create new
            const existing = await prisma.systemAlert.findFirst({ where: { type: 'MISCONCEPTION_HIGH_PREVALENCE', message } })
            if (existing) {
              await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload: { misconceptionId: mis.id, prevalenceRate, conceptId: mis.conceptId, subjectId: mis.subjectId } } })
            } else {
              await prisma.systemAlert.create({ data: { type: 'MISCONCEPTION_HIGH_PREVALENCE', severity: 'WARNING', message, payload: { misconceptionId: mis.id, prevalenceRate, conceptId: mis.conceptId, subjectId: mis.subjectId }, active: true } })
            }
          } else {
            // Resolve any existing active alerts for this misconception (by message match)
            const existing = await prisma.systemAlert.findFirst({ where: { type: 'MISCONCEPTION_HIGH_PREVALENCE', message } })
            if (existing && existing.active) {
              await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date() } })
            }
          }
        }
      } catch (alertErr) {
        logger.error('misconceptionPrevalence.alert.failed', { error: String((alertErr as any)?.message ?? alertErr) })
      }
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
