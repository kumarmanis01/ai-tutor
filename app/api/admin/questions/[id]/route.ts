import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { QuestionStatus, AdminActionType } from '@prisma/client'

// F-ADM-003 AC-03: approve (ACTIVE) or reject (REJECTED) a quarantined question.
// F-ADM-003 AC-05: force-validate a manually authored question (validated=true).
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

  const question = await prisma.question.findUnique({ where: { id }, select: { id: true } })
  if (!question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (validated === true) {
    // Force-validate: marks IRT parameters as trusted (for manually authored questions)
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
      },
    }),
  ])

  return NextResponse.json({ ok: true, status })
}
