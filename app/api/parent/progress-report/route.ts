export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { formatErrorForResponse } from '@/lib/errorResponse'
import type { AppSession } from '@/lib/types/auth'
import { buildProgressReport } from '@/lib/parent/progressReport'

const CLASS_NAME = 'ParentProgressReportAPI'

/**
 * GET /api/parent/progress-report?studentId=xxx
 * Parent-auth-only. Read-only aggregated progress report; no raw chat content exposed.
 */
export async function GET(req: NextRequest) {
  const start = Date.now()
  const METHOD_NAME = 'GET'

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'parent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const studentId = req.nextUrl.searchParams.get('studentId')
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }

    const parentId = session.user.id

    const studentExists = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true },
    })
    if (!studentExists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { id: true, status: true },
    })
    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 })
    }

    const totalSessions = await prisma.learningSession.count({ where: { studentId } })
    if (totalSessions < 3) {
      const res = NextResponse.json({ message: 'Insufficient data' }, { status: 202 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: METHOD_NAME }, start)
      return res
    }

    const report = await buildProgressReport(parentId, studentId)
    if (!report) {
      const res = NextResponse.json({ error: 'Could not build progress report' }, { status: 500 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: METHOD_NAME }, start)
      return res
    }

    await prisma.auditLog
      .create({
        data: {
          userId: parentId,
          action: 'parent_view_progress_report',
          details: { parentId, studentId },
        },
      })
      .catch(() => {})

    const res = NextResponse.json(report, { status: 200 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: METHOD_NAME }, start)
    return res
  } catch (err) {
    logger.error('Progress report failed', { className: CLASS_NAME, methodName: METHOD_NAME, err })
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: METHOD_NAME }, start)
    return res
  }
}

