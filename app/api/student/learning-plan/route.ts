import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getNextConcept } from '@/lib/student/learningPlan'
import { logger } from '@/lib/logger'
import { cacheGet, cacheSet } from '@/lib/cache'

export const dynamic = 'force-dynamic'

const CACHE_TTL_S = 120
const cacheKey = (userId: string) => `lplan:v1:${userId}`

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
