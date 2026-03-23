import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { FlagReason, QuestionStatus, AdminActionType } from '@prisma/client'

const VALID_REASONS = new Set<string>(Object.values(FlagReason))
const AUTO_QUARANTINE_THRESHOLD = 3

export async function POST(
  req: NextRequest,
  { params }: { params: { questionId: string } },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionId } = params
  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason ?? ''
  const details: string | undefined = typeof body.details === 'string' ? body.details : undefined

  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json(
      { error: `reason must be one of: ${[...VALID_REASONS].join(', ')}` },
      { status: 400 },
    )
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, status: true },
  })
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Upsert -- @@unique([questionId, studentId]) prevents duplicate flags
  await prisma.sessionQuestionFlag.upsert({
    where: { questionId_studentId: { questionId, studentId: session.user.id } },
    create: { questionId, studentId: session.user.id, reason: reason as FlagReason, details: details ?? null },
    update: { reason: reason as FlagReason, details: details ?? null },
  })

  const totalFlags = await prisma.sessionQuestionFlag.count({ where: { questionId } })

  // Auto-quarantine at threshold -- idempotent (may already be QUARANTINED)
  if (totalFlags >= AUTO_QUARANTINE_THRESHOLD && question.status === QuestionStatus.ACTIVE) {
    await prisma.$transaction([
      prisma.question.update({
        where: { id: questionId },
        data: { status: QuestionStatus.QUARANTINED },
      }),
      prisma.auditLog.create({
        data: {
          targetEntity: 'Question',
          targetId: questionId,
          action: AdminActionType.QUESTION_QUARANTINE,
          details: { legacyAction: 'auto_quarantine', triggerCount: totalFlags },
        },
      }),
    ])
  }

  return NextResponse.json({ flagged: true, totalFlags })
}
