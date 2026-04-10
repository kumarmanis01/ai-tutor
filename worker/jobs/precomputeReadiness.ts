/**
 * Nightly readiness pre-compute job (T35)
 *
 * Runs at 21:30 UTC (≈ 3:00 AM IST).
 *
 * For each student who had at least one session in the last 7 days:
 *   - Resolve their enrolled subjects (User.subjects string array → SubjectDef.id)
 *   - Call computeReadinessScore per subject to warm the Redis cache
 *
 * Never throws -- logs and continues on per-student errors.
 */

import { prisma } from '@/lib/prisma'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { sendPushSafe } from '@/lib/push/send'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'

const READINESS_NOTIFICATION_THRESHOLDS = [50, 70, 90]
/** AC-05 (F-STU-023): fire a drop alert when score falls by more than this many points. */
const READINESS_DROP_THRESHOLD = 10
const READINESS_SCORE_TTL_S = 8 * 24 * 60 * 60 // 8-day TTL for previous-score key

export async function precomputeReadiness(): Promise<{ students: number; scores: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // 1. Students active in the last 7 days
  const activeRows = await prisma.structuredSession.findMany({
    where: { startedAt: { gte: since } },
    select: { studentId: true },
    distinct: ['studentId'],
  })

  if (activeRows.length === 0) return { students: 0, scores: 0 }

  const studentIds = activeRows.map((r) => r.studentId)

  // 2. Load subjects for those students
  const users = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, subjects: true },
  })

  // Collect all unique subject name/slug strings
  const allSubjectStrings = [
    ...new Set(users.flatMap((u) => (u.subjects as string[]).filter(Boolean))),
  ]

  if (allSubjectStrings.length === 0) return { students: 0, scores: 0 }

  // 3. Resolve to SubjectDef IDs once (shared lookup)
  const subjectDefs = await prisma.subjectDef.findMany({
    where: {
      lifecycle: 'active',
      OR: [{ name: { in: allSubjectStrings } }, { slug: { in: allSubjectStrings } }],
    },
    select: { id: true, name: true, slug: true },
  })

  // Build name/slug → id map  and id → name map
  const subjectIdMap = new Map<string, string>()
  const subjectNameById = new Map<string, string>()
  for (const sd of subjectDefs) {
    subjectIdMap.set(sd.name, sd.id)
    if (sd.slug) subjectIdMap.set(sd.slug, sd.id)
    subjectNameById.set(sd.id, sd.name)
  }

  // 4. Pre-compute per student × subject
  let totalScores = 0
  let processedStudents = 0

  for (const user of users) {
    const subjectIds = (user.subjects as string[])
      .filter(Boolean)
      .map((s) => subjectIdMap.get(s))
      .filter((id): id is string => id !== undefined)

    if (subjectIds.length === 0) continue

    processedStudents++
    for (const subjectId of subjectIds) {
      try {
        const readiness = await computeReadinessScore(user.id, subjectId)
        totalScores++

        const subjectName = subjectNameById.get(subjectId) ?? subjectId
        // Fire readiness milestone push if score crosses 50/70/90 for the first time
        await maybeFireReadinessMilestone(user.id, subjectId, subjectName, readiness.score)
        // AC-05 (F-STU-023): fire drop alert when score drops > 10 points
        await maybeFireReadinessDrop(user.id, subjectId, subjectName, readiness.score)
      } catch (err) {
        logger.error('precomputeReadiness.scoreError', {
          studentId: user.id,
          subjectId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return { students: processedStudents, scores: totalScores }
}

/**
 * AC-05 (F-STU-023): Compare current readiness score against stored previous score.
 * If the drop exceeds READINESS_DROP_THRESHOLD, fire a push notification.
 * Stores the new score with an 8-day TTL so daily runs can detect the delta.
 */
async function maybeFireReadinessDrop(
  studentId: string,
  subjectId: string,
  subjectName: string,
  score: number,
): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return

    const scoreKey = `readiness:score:${studentId}:${subjectId}`
    const prevRaw = await redis.get(scoreKey)
    const prevScore = prevRaw !== null ? parseFloat(prevRaw) : null

    // Always update the stored score so tomorrow's run has the latest
    await redis.set(scoreKey, String(score), 'EX', READINESS_SCORE_TTL_S)

    if (prevScore === null) return // First run -- no baseline to compare

    const drop = prevScore - score
    if (drop > READINESS_DROP_THRESHOLD) {
      const dropPoints = Math.round(drop)
      await sendPushSafe(studentId, PUSH_NOTIFICATIONS.readiness_drop(subjectName, dropPoints))
      logger.info('precomputeReadiness.dropAlert', {
        event: 'readiness_drop_alert',
        context: { studentId, subjectId, prevScore, newScore: score, dropPoints },
      })
    }
  } catch {
    // Best-effort
  }
}

/**
 * Fire a readiness milestone push once per threshold per student per subject.
 * Uses Redis key readiness:notified:{studentId}:{subjectId}:{threshold} to prevent duplicates.
 */
async function maybeFireReadinessMilestone(
  studentId: string,
  subjectId: string,
  subjectName: string,
  score: number,
): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return

    for (const threshold of READINESS_NOTIFICATION_THRESHOLDS) {
      if (score < threshold) continue
      const key = `readiness:notified:${studentId}:${subjectId}:${threshold}`
      const alreadySent = await redis.get(key)
      if (alreadySent) continue
      await redis.set(key, '1', 'EX', 365 * 24 * 60 * 60) // 1 year TTL
      await sendPushSafe(studentId, PUSH_NOTIFICATIONS.readiness_milestone(score, subjectName))
      break // Only send the highest newly-crossed threshold
    }
  } catch {
    // Best-effort
  }
}
