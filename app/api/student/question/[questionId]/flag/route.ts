/**
 * FILE OBJECTIVE:
 * - Accept student question flags, move flagged bank questions into the review queue immediately, and preserve the selected reason for admin moderation.
 *
 * LINKED UNIT TEST:
 * - tests/integration/admin/audit.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | move flagged questions into review immediately and preserve user-selected reason labels for admin review
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { FlagReason, QuestionStatus, AdminActionType } from '@prisma/client'
import {
  buildQuestionFlagDetails,
  resolveQuestionFlagReason,
} from '@/lib/questions/questionFlagging'

const AUTO_QUARANTINE_THRESHOLD = 3

function determineReviewStatus(
  currentStatus: QuestionStatus,
  totalFlags: number,
): QuestionStatus | null {
  if (currentStatus === QuestionStatus.ACTIVE) {
    return QuestionStatus.PENDING_REVIEW
  }

  if (
    currentStatus === QuestionStatus.PENDING_REVIEW &&
    totalFlags >= AUTO_QUARANTINE_THRESHOLD
  ) {
    return QuestionStatus.QUARANTINED
  }

  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionId } = await params
  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason ?? ''
  const details: string | undefined = typeof body.details === 'string' ? body.details : undefined
  const resolvedReason = resolveQuestionFlagReason(reason)

  if (!resolvedReason.isValid || !resolvedReason.storedReason || !resolvedReason.label) {
    return NextResponse.json(
      { error: `reason must be one of: ${Object.values(FlagReason).join(', ')}` },
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
    create: {
      questionId,
      studentId: session.user.id,
      reason: resolvedReason.storedReason as FlagReason,
      details: buildQuestionFlagDetails(resolvedReason.label, details),
    },
    update: {
      reason: resolvedReason.storedReason as FlagReason,
      details: buildQuestionFlagDetails(resolvedReason.label, details),
    },
  })

  const totalFlags = await prisma.sessionQuestionFlag.count({ where: { questionId } })
  const reviewStatus = determineReviewStatus(question.status, totalFlags)

  if (reviewStatus) {
    await prisma.$transaction([
      prisma.question.update({
        where: { id: questionId },
        data: { status: reviewStatus },
      }),
      prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'Question',
          targetId: questionId,
          action: AdminActionType.QUESTION_QUARANTINE,
          details: {
            previousStatus: question.status,
            nextStatus: reviewStatus,
            selectedReason: resolvedReason.label,
            storedReason: resolvedReason.storedReason,
            triggerCount: totalFlags,
          },
        },
      }),
    ])
  }

  return NextResponse.json({
    flagged: true,
    totalFlags,
    reviewStatus: reviewStatus ?? question.status,
    reasonLabel: resolvedReason.label,
  })
}
