import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getNextConcept } from '@/lib/student/learningPlan'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const recentlyCompleted = await Promise.all(
    plan.items.map(async (item) => {
      const concept = await prisma.concept.findUnique({
        where: { id: item.conceptId },
        select: { name: true },
      })
      return {
        conceptName: concept?.name ?? '',
        completedAt: item.completedAt ? item.completedAt.toISOString() : '',
      }
    }),
  )

  const res = NextResponse.json(
    {
      planId: plan.id,
      subjectName,
      totalConcepts,
      completedConcepts: completedCount,
      progressPercent,
      nextConcept: nextConceptPayload,
      recentlyCompleted,
    },
    { status: 200 },
  )
  logger.logAPI(req, res, { className: 'LearningPlanAPI', methodName: 'GET' }, start)
  return res
}
