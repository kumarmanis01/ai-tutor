import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getNextConcept } from '@/lib/student/learningPlan'
import { logger } from '@/lib/logger'
import { cacheGet, cacheSet } from '@/lib/cache'
import { generateLearningPlan } from '@/lib/ai/learningPlan'
import { formatErrorForResponse } from '@/lib/errorResponse'

export const dynamic = 'force-dynamic'

const CACHE_TTL_S = 120
const cacheKey = (userId: string) => `lplan:v1:${userId}`

/**
 * PATCH /api/student/learning-plan
 * AC-07 (F-STU-003): Update exam date / study days per week and regenerate the plan.
 * AC-02 (F-STU-003): Returns belowMinimumHours=true when weekly study time < 180 min (3 hrs).
 * Body: { examDate?: string | null, studyDaysPerWeek?: number }
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | AC-02: add belowMinimumHours warning to PATCH response
 */
export async function PATCH(req: NextRequest) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'PATCH' }, start)
      return res
    }

    const body = await req.json().catch(() => ({}))

    const studyDaysRaw = body.studyDaysPerWeek !== undefined ? Number(body.studyDaysPerWeek) : null
    const studyDaysPerWeek =
      studyDaysRaw !== null && Number.isInteger(studyDaysRaw) && studyDaysRaw >= 1 && studyDaysRaw <= 7
        ? studyDaysRaw
        : null

    let examDate: Date | null = null
    if (body.examDate && typeof body.examDate === 'string') {
      const parsed = new Date(body.examDate)
      if (!isNaN(parsed.getTime()) && parsed > new Date()) {
        examDate = parsed
      }
    }

    // AC-02: compute weekly study minutes for the under-3-hrs warning
    const profile = await prisma.studentLearningProfile.findUnique({
      where: { studentId: userId },
      select: { dailyTargetMin: true, studyDaysPerWeek: true },
    });
    const resolvedDailyMin = profile?.dailyTargetMin ?? 30;
    const resolvedStudyDays = studyDaysPerWeek ?? profile?.studyDaysPerWeek ?? 5;
    const weeklyMinutes = resolvedStudyDays * resolvedDailyMin;
    const belowMinimumHours = weeklyMinutes < 180; // 3 hrs = 180 min

    // Fetch all plans for the student so we can regenerate each subject
    const plans = await prisma.learningPlan.findMany({
      where: { studentId: userId },
      select: { subjectId: true, weeklyGoal: true, examDate: true },
    })

    if (plans.length === 0) {
      const res = NextResponse.json({ error: 'No learning plan found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'PATCH' }, start)
      return res
    }

    // Update StudentLearningProfile if studyDaysPerWeek provided
    if (studyDaysPerWeek !== null) {
      await prisma.studentLearningProfile.upsert({
        where: { studentId: userId },
        update: { studyDaysPerWeek },
        create: { studentId: userId, studyDaysPerWeek },
      })
    }

    // Regenerate plan for each subject with updated params
    const errors: string[] = []
    for (const plan of plans) {
      const resolvedDays = studyDaysPerWeek ?? plan.weeklyGoal
      const resolvedExamDate = examDate ?? plan.examDate ?? undefined
      try {
        await generateLearningPlan(userId, plan.subjectId, {
          examDate: resolvedExamDate instanceof Date ? resolvedExamDate : undefined,
          weeklyGoal: resolvedDays,
        })
      } catch (err) {
        errors.push(`subjectId=${plan.subjectId}: ${String(err)}`)
        logger.warn('LearningPlanAPI PATCH: regen failed', {
          event: 'learning_plan_regen_failed',
          context: { userId, subjectId: plan.subjectId, error: String(err) },
        })
      }
    }

    const res = NextResponse.json({ ok: true, regenerated: plans.length - errors.length, errors, belowMinimumHours, weeklyMinutes })
    logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'PATCH' }, start)
    return res
  } catch (err) {
    logger.error('LearningPlanAPI PATCH error', {
      className: 'LearningPlanAPI',
      methodName: 'PATCH',
      error: err,
    })
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'GET' }, start)
    return res
  }

  // Cache check
  const cached = await cacheGet<object>(cacheKey(userId))
  if (cached) {
    const res = NextResponse.json(cached)
    res.headers.set('X-Cache', 'HIT')
    logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'GET' }, start)
    return res
  }

  const plan = await prisma.learningPlan.findFirst({
    where: { studentId: userId },
    orderBy: { generatedAt: 'desc' },
    select: {
      id: true,
      subjectId: true,
      _count: { select: { items: true } },
      items: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 3,
        select: { conceptId: true, completedAt: true },
      },
    },
  })

  if (!plan) {
    const res = NextResponse.json(
      { planId: null, message: 'Diagnostic in progress' },
      { status: 202 },
    )
    logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'GET' }, start)
    return res
  }

  const completedCount = await prisma.learningPlanItem.count({
    where: { planId: plan.id, status: 'COMPLETED' },
  })
  const totalConcepts = plan._count.items
  const progressPercent = totalConcepts > 0 ? Math.round((completedCount / totalConcepts) * 100) : 0

  const subject = await prisma.subjectDef.findUnique({
    where: { id: plan.subjectId },
    select: { name: true },
  })
  const subjectName = subject?.name ?? ''

  const nextConcept = await getNextConcept(userId)
  const nextConceptPayload = nextConcept
    ? {
        conceptId: nextConcept.conceptId,
        conceptName: nextConcept.conceptName,
        chapterName: nextConcept.chapterName,
        masteryScore: nextConcept.masteryScore,
      }
    : null

  // Batch concept lookup -- avoids N+1 (one query for all 3 recent items)
  const recentConceptIds = plan.items.map((i) => i.conceptId)
  const recentConcepts = recentConceptIds.length
    ? await prisma.concept.findMany({
        where: { id: { in: recentConceptIds } },
        select: { id: true, name: true },
      })
    : []
  const conceptNameById = new Map(recentConcepts.map((c) => [c.id, c.name]))
  const recentlyCompleted = plan.items.map((item) => ({
    conceptName: conceptNameById.get(item.conceptId) ?? '',
    completedAt: item.completedAt ? item.completedAt.toISOString() : '',
  }))

  const payload = {
    planId: plan.id,
    subjectName,
    totalConcepts,
    completedConcepts: completedCount,
    progressPercent,
    nextConcept: nextConceptPayload,
    recentlyCompleted,
  }

  await cacheSet(cacheKey(userId), payload, CACHE_TTL_S)

  const res = NextResponse.json(payload, { status: 200 })
  res.headers.set('X-Cache', 'MISS')
  logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'GET' }, start)
  return res
}
