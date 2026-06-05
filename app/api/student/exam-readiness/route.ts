import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeExamReadiness } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MIN_SCS_ROWS_FOR_READINESS = 5

export async function GET(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    logger.logAPI(req, res, { className: 'ExamReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('subjectId')
  if (!subjectId || subjectId.trim() === '') {
    const res = NextResponse.json(
      { error: 'subjectId is required', code: 'BAD_REQUEST' },
      { status: 400 },
    )
    logger.logAPI(req, res, { className: 'ExamReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  const conceptIds = await prisma.concept.findMany({
    where: { subjectId: subjectId.trim() },
    select: { id: true },
  })
  const ids = conceptIds.map((c: any) => c.id)
  if (ids.length === 0) {
    const res = NextResponse.json(
      { message: 'Insufficient data' },
      { status: 202 },
    )
    logger.logAPI(req, res, { className: 'ExamReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  const scsCount = await prisma.studentConceptState.count({
    where: { studentId: userId, conceptId: { in: ids } },
  })
  if (scsCount < MIN_SCS_ROWS_FOR_READINESS) {
    const res = NextResponse.json(
      { message: 'Insufficient data' },
      { status: 202 },
    )
    logger.logAPI(req, res, { className: 'ExamReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  const result = await computeExamReadiness(userId, subjectId.trim())
  if (!result) {
    const res = NextResponse.json(
      { error: 'Failed to compute readiness', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
    logger.logAPI(req, res, { className: 'ExamReadinessAPI', methodName: 'GET' }, start)
    return res
  }

  const res = NextResponse.json(result, { status: 200 })
  logger.logAPI(req, res, { className: 'ExamReadinessAPI', methodName: 'GET' }, start)
  return res
}
