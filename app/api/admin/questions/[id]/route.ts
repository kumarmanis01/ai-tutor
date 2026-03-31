import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { QuestionStatus, AdminActionType } from '@prisma/client'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }

  if (status !== 'ACTIVE' && status !== 'REJECTED') {
    return NextResponse.json({ error: 'status must be ACTIVE or REJECTED' }, { status: 400 })
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
