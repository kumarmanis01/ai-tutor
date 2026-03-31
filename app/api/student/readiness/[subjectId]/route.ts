import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/student/readiness/[subjectId]
 *
 * Returns exam readiness for the student + subject.
 * Result is Redis-cached (TTL 3600s) inside computeReadinessScore.
 *
 * Response (Domain 7 §7.8):
 *   { subjectId, subjectName, overallScore, label, isCrunchMode,
 *     chapters, lastUpdatedAt }
 *
 * isCrunchMode = daysToExam <= 14 (examDate from LearningPlan or null)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'ReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  const { subjectId } = await params
  if (!subjectId?.trim()) {
    const res = NextResponse.json({ error: 'subjectId required' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  // Fetch subject name + exam date in parallel with readiness computation
  const [readiness, subject, plan] = await Promise.all([
    computeReadinessScore(userId, subjectId),
    prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: { name: true },
    }),
    prisma.learningPlan.findFirst({
      where: { studentId: userId, subjectId },
      orderBy: { generatedAt: 'desc' },
      select: { examDate: true },
    }),
  ])

  // isCrunchMode: exam within the next 14 days
  const examDate = plan?.examDate ?? null
  const daysToExam = examDate
    ? Math.ceil((examDate.getTime() - Date.now()) / 86_400_000)
    : null
  const isCrunchMode = daysToExam !== null && daysToExam <= 14 && daysToExam >= 0

  const res = NextResponse.json(
    {
      subjectId,
      subjectName: subject?.name ?? '',
      overallScore: readiness.score,
      label: readiness.label,
      isCrunchMode,
      daysToExam,
      chapters: readiness.chapters,
      lastUpdatedAt: new Date().toISOString(),
    },
    { status: 200 },
  )
  logger.logAPI(req, res, { className: 'ReadinessAPI', methodName: 'GET' }, start)
  return res
}
