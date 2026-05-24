/**
 * FILE OBJECTIVE:
 * - PATCH endpoint for admin question review actions: approve, reject, or force-validate.
 * - Approve/reject applies to review-queue questions so admins can clear flagged content cleanly.
 * - Force-validate is restricted to manually authored questions (source='manual') only;
 *   AI-generated questions are validated automatically by the nightly IRT job after
 *   50 responses (F-ADM-003 AC-05).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/questions/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-04T20:00:00Z | claude | added validated:true force-validate path for F-ADM-003 AC-05
 * - 2026-05-04T21:00:00Z | claude | fix: guard force-validate to source='manual' only; add file header
 * - 2026-05-13T00:00:00Z | copilot | include previous review status in admin approve/reject audit records
 * - 2026-05-13T00:00:00Z | copilot | add GET handler to return full question details with all student flags for admin review modal
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { QuestionStatus, AdminActionType } from '@prisma/client'

const MANUAL_SOURCE = 'manual'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      sessionFlags: {
        select: {
          id: true,
          reason: true,
          details: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      topic: { select: { name: true } },
    },
  })

  if (!question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Normalize field names for API response: choices -> options, correctAnswer -> answer
  return NextResponse.json({
    ...question,
    options: question.choices,
    answer: question.correctAnswer,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status, validated } = body as { status?: string; validated?: boolean }

  if (!status && validated === undefined) {
    return NextResponse.json(
      { error: 'Provide status (ACTIVE or REJECTED) or validated (true)' },
      { status: 400 },
    )
  }

  if (status !== undefined && status !== 'ACTIVE' && status !== 'REJECTED') {
    return NextResponse.json({ error: 'status must be ACTIVE or REJECTED' }, { status: 400 })
  }

  const question = await prisma.question.findUnique({
    where: { id },
    select: { id: true, source: true, status: true },
  })
  if (!question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (validated === true) {
    // Force-validate is only valid for manually authored questions. AI-generated
    // questions are promoted automatically by the nightly IRT job after >= 50 responses.
    if (question.source !== MANUAL_SOURCE) {
      return NextResponse.json(
        {
          error: 'invalid_source',
          message:
            'Force-validate is only for manually authored questions (source=manual). ' +
            'AI-generated questions are validated automatically after 50 student responses.',
        },
        { status: 422 },
      )
    }

    await prisma.$transaction([
      prisma.question.update({
        where: { id },
        data: { validated: true, validatedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'Question',
          targetId: id,
          action: AdminActionType.QUESTION_APPROVE,
          newValue: { validated: true, forcedBy: session.user.id },
        },
      }),
    ])
    return NextResponse.json({ ok: true, validated: true })
  }

  const action =
    status === 'ACTIVE' ? AdminActionType.QUESTION_APPROVE : AdminActionType.QUESTION_REJECT

  await prisma.$transaction([
    prisma.question.update({ where: { id }, data: { status: status as QuestionStatus } }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'Question',
        targetId: id,
        action,
        details: {
          previousStatus: question.status,
          nextStatus: status,
        },
      },
    }),
  ])

  return NextResponse.json({ ok: true, status })
}
