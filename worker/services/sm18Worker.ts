import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { updateSM18 } from '@/lib/ai/tutor/sm18.js'

const BATCH_SIZE = 100
const MS_PER_DAY = 86400000

export async function processNightlySM18(_job?: Job): Promise<void> {
  const now = new Date()
  let totalProcessed = 0
  let totalUpdated = 0
  let totalErrors = 0

  try {
    for (;;) {
      const batch = await prisma.studentConceptState.findMany({
        where: {
          OR: [
            { nextReviewAt: { lte: now } },
            { nextReviewAt: null },
          ],
        },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      })

      if (batch.length === 0) break

      for (const row of batch) {
        totalProcessed += 1
        try {
          const elapsedMs = now.getTime() - row.lastInteraction.getTime()
          const elapsedDays = elapsedMs / MS_PER_DAY

          const result = updateSM18({
            stability: row.stability,
            retention: row.retention,
            isCorrect: true,
            elapsedDays,
          })

          const nextReviewAt = new Date(now.getTime() + result.nextReviewInDays * MS_PER_DAY)

          await prisma.studentConceptState.update({
            where: { id: row.id },
            data: {
              stability: result.newStability,
              retention: result.newRetention,
              nextReviewAt,
            },
          })
          totalUpdated += 1
        } catch (err) {
          totalErrors += 1
          logger.warn('[sm18-worker] row update failed', {
            id: row.id,
            studentId: row.studentId,
            conceptId: row.conceptId,
            error: String((err as any)?.message ?? err),
          })
        }
      }
    }

    logger.info('[sm18-worker] batch summary', {
      processed: totalProcessed,
      updated: totalUpdated,
      errors: totalErrors,
    })
  } catch (err) {
    logger.error('[sm18-worker] nightly run failed', {
      error: String((err as any)?.message ?? err),
    })
    throw err
  }
}
