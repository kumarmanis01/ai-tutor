/**
 * Nightly readiness pre-compute job (T35)
 *
 * Runs at 21:30 UTC (≈ 3:00 AM IST).
 *
 * For each student who had at least one session in the last 7 days:
 *   - Resolve their enrolled subjects (User.subjects string array → SubjectDef.id)
 *   - Call computeReadinessScore per subject to warm the Redis cache
 *
 * Never throws — logs and continues on per-student errors.
 */

import { prisma } from '../../lib/prisma.js'
import { computeReadinessScore } from '../../lib/student/examReadiness.js'
import { logger } from '../../lib/logger.js'

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

  // Build name/slug → id map
  const subjectIdMap = new Map<string, string>()
  for (const sd of subjectDefs) {
    subjectIdMap.set(sd.name, sd.id)
    if (sd.slug) subjectIdMap.set(sd.slug, sd.id)
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
        await computeReadinessScore(user.id, subjectId)
        totalScores++
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
