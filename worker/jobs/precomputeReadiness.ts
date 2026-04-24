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
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'

const READINESS_NOTIFICATION_THRESHOLDS = [50, 70, 90]
/** AC-05 (F-STU-023): fire a drop alert when score falls by more than this many points. */
const READINESS_DROP_THRESHOLD = 10
const READINESS_SCORE_TTL_S = 8 * 24 * 60 * 60 // 8-day TTL for previous-score key

export async function precomputeReadiness(): Promise<{ students: number; scores: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // 1. Students active in the last 7 days
  // Local row types for strict mode
  type ActiveRow = { studentId: string };
  type UserRow = { id: string; subjects: string[] };
  type SubjectDefRow = { id: string; name: string; slug: string | null };
  type ParentLinkRow = { parent: { id: string; email: string | null; whatsappPhone: string | null; name: string | null; language: string | null } };

  const activeRows = await prisma.structuredSession.findMany({
    where: { startedAt: { gte: since } },
    select: { studentId: true },
    distinct: ['studentId'],
  }) as ActiveRow[]

  if (activeRows.length === 0) return { students: 0, scores: 0 }

  const studentIds = (activeRows as ActiveRow[]).map((r: ActiveRow) => r.studentId)

  // 2. Load subjects for those students
  const users = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, subjects: true },
  }) as UserRow[]

  // Collect all unique subject name/slug strings
  const allSubjectStrings = [
    ...new Set((users as UserRow[]).flatMap((u: UserRow) => (u.subjects as string[]).filter(Boolean))),
  ]

  if (allSubjectStrings.length === 0) return { students: 0, scores: 0 }

  // 3. Resolve to SubjectDef IDs once (shared lookup)
  const subjectDefs = await prisma.subjectDef.findMany({
    where: {
      lifecycle: 'active',
      OR: [{ name: { in: allSubjectStrings } }, { slug: { in: allSubjectStrings } }],
    },
    select: { id: true, name: true, slug: true },
  }) as SubjectDefRow[]

  // Build name/slug → id map  and id → name map
  const subjectIdMap = new Map<string, string>()
  const subjectNameById = new Map<string, string>()
  for (const sd of subjectDefs as SubjectDefRow[]) {
    subjectIdMap.set(sd.name, sd.id)
    if (sd.slug) subjectIdMap.set(sd.slug, sd.id)
    subjectNameById.set(sd.id, sd.name)
  }

  // 4. Pre-compute per student × subject
  let totalScores = 0
  let processedStudents = 0

  for (const user of users as UserRow[]) {
    const subjectIds = (user.subjects as string[])
      .filter(Boolean)
      .map((s: string) => subjectIdMap.get(s))
      .filter((id): id is string => id !== undefined)

    if (subjectIds.length === 0) continue

    processedStudents++

    // Fetch parent links once per student (not once per subject)
    let parentLinks: ParentLinkRow[] = []
    try {
      parentLinks = await prisma.parentStudent.findMany({
        where: { studentId: user.id, status: 'active' },
        select: { parent: { select: { id: true, email: true, whatsappPhone: true, name: true, language: true } } },
      }) as ParentLinkRow[]
    } catch (err) {
      logger.warn('precomputeReadiness.parentLinksFailed', { studentId: user.id, error: String(err) })
    }

    for (const subjectId of subjectIds) {
      try {
        const readiness = await computeReadinessScore(user.id, subjectId)
        totalScores++

        // Persist a daily snapshot of readiness in Redis so downstream
        // workers (e.g. readiness-drop detection) can compare history.
        try {
          const redis = getRedis()
          if (redis) {
            const dateLabel = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
            const key = `readiness:history:${user.id}:${subjectId}:${dateLabel}`
            // Keep history for 120 days
            await redis.set(key, String(Math.round(readiness.score)), 'EX', 120 * 24 * 60 * 60)
          }
        } catch (e) {
          // best-effort, do not fail the precompute job
          logger.error('precomputeReadiness.redisSnapshotFailed', { studentId: user.id, subjectId, err: String(e) })
        }

        const subjectName = subjectNameById.get(subjectId) ?? subjectId
        // Fire readiness milestone push if score crosses 50/70/90 for the first time
        await maybeFireReadinessMilestone(user.id, subjectId, subjectName, readiness.score, parentLinks)
        // AC-05 (F-STU-023): fire drop alert when score drops > 10 points
        await maybeFireReadinessDrop(user.id, subjectId, subjectName, readiness.score, parentLinks)
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
 * parentLinks are pre-fetched once per student by the caller.
 */
async function maybeFireReadinessDrop(
  studentId: string,
  subjectId: string,
  subjectName: string,
  score: number,
  parentLinks: Array<{ parent: { id: string; email: string | null; whatsappPhone: string | null; name: string | null; language: string | null } }>,
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
      // Notify parents about readiness drop (best-effort, using pre-fetched links)
      if (parentLinks.length > 0) {
        try {
          const subject = `Readiness dropped: ${subjectName} -- ${dropPoints} points`
          const html = `<p>Hi,</p><p>Your child's readiness score for <strong>${subjectName}</strong> dropped by ${dropPoints} points. A short review session can help recover progress.</p>`
          const sends = parentLinks.map((pl) =>
            sendParentMilestoneNotification(pl.parent.id, {
              email: pl.parent.email ?? undefined,
              whatsappPhone: pl.parent.whatsappPhone ?? undefined,
              subject,
              html,
              meta: { studentId, type: 'milestone', locale: pl.parent.language ?? undefined },
            }),
          )
          void Promise.allSettled(sends)
        } catch (err) {
          logger.warn('precomputeReadiness.parentNotify.drop failed', { studentId, subjectId, error: String(err) })
        }
      }
    }
  } catch {
    // Best-effort
  }
}

/**
 * Fire a readiness milestone push once per threshold per student per subject.
 * Uses Redis key readiness:notified:{studentId}:{subjectId}:{threshold} to prevent duplicates.
 * parentLinks are pre-fetched once per student by the caller.
 */
async function maybeFireReadinessMilestone(
  studentId: string,
  subjectId: string,
  subjectName: string,
  score: number,
  parentLinks: Array<{ parent: { id: string; email: string | null; whatsappPhone: string | null; name: string | null; language: string | null } }>,
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
      // Notify parents about readiness milestone (best-effort, using pre-fetched links)
      if (parentLinks.length > 0) {
        try {
          const subject = `Readiness milestone: ${subjectName} -- ${score}%`
          const html = `<p>Hi,</p><p>Your child has reached a readiness score of <strong>${score}%</strong> in <strong>${subjectName}</strong>. Keep up the great work!</p>`
          const sends = parentLinks.map((pl) =>
            sendParentMilestoneNotification(pl.parent.id, {
              email: pl.parent.email ?? undefined,
              whatsappPhone: pl.parent.whatsappPhone ?? undefined,
              subject,
              html,
              meta: { studentId, type: 'milestone', locale: pl.parent.language ?? undefined },
            }),
          )
          void Promise.allSettled(sends)
        } catch (err) {
          logger.warn('precomputeReadiness.parentNotify.milestone failed', { studentId, subjectId, threshold, error: String(err) })
        }
      }
      break // Only send the highest newly-crossed threshold
    }
  } catch {
    // Best-effort
  }
}
