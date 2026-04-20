/**
 * FILE OBJECTIVE:
 * - Allow a parent to set or update the `examDate` for a linked child (admin action by parent).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-exam-date.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateLearningPlan } from '@/lib/ai/learningPlan'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const parentId = (session?.user as { id?: string })?.id
  if (!parentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'ParentSetExamDateAPI', methodName: 'POST' }, start)
    return res
  }

  const body = await req.json().catch(() => ({})) as any
  const studentId = typeof body.studentId === 'string' ? body.studentId : ''
  const examDateRaw = typeof body.examDate === 'string' ? body.examDate : ''
    if (!studentId || !examDateRaw) {
    const res = NextResponse.json({ error: 'studentId and examDate required' }, { status: 400 })
    if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'ParentSetExamDateAPI', methodName: 'POST' }, start)
    return res
  }

  const examDate = new Date(examDateRaw)
    if (Number.isNaN(examDate.getTime())) {
    const res = NextResponse.json({ error: 'Invalid examDate' }, { status: 400 })
    if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'ParentSetExamDateAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    // Ensure parent is linked to the student
    const link = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } })
    if (!link || link.status !== 'active') {
      const res = NextResponse.json({ error: 'Parent not linked to student' }, { status: 403 })
      if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'ParentSetExamDateAPI', methodName: 'POST' }, start)
      return res
    }

    await prisma.user.update({ where: { id: studentId }, data: { examDate } })

    // Non-blocking: regenerate existing learning plans for the student to respect the new exam date.
    // Runs in a .then() to avoid delaying the API response (consistent with onboarding patterns).
    // Guard access because test prisma mock may not include the `learningPlan` model.
    const lpModel = (prisma as any).learningPlan
    if (lpModel && typeof lpModel.findMany === 'function') {
      lpModel
        .findMany({ where: { studentId }, select: { subjectId: true, weeklyGoal: true } })
        .then(async (plans: Array<{ subjectId: string; weeklyGoal: number }>) => {
          if (!plans || plans.length === 0) return
          for (const p of plans) {
            try {
              await generateLearningPlan(studentId, p.subjectId, { examDate, weeklyGoal: p.weeklyGoal })
            } catch (err) {
              logger.warn('ParentSetExamDateAPI: regenerate learning plan failed', {
                className: 'ParentSetExamDateAPI',
                methodName: 'POST',
                studentId,
                subjectId: p.subjectId,
                error: String(err),
              })
            }
          }
        })
        .catch((err: any) => {
          logger.warn('ParentSetExamDateAPI: failed to fetch learning plans for regen', {
            className: 'ParentSetExamDateAPI',
            methodName: 'POST',
            studentId,
            error: String(err),
          })
        })
    }

    const res = NextResponse.json({ ok: true }, { status: 200 })
    if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'ParentSetExamDateAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('ParentSetExamDateAPI failed', { className: 'ParentSetExamDateAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'ParentSetExamDateAPI', methodName: 'POST' }, start)
    return res
  }
}
