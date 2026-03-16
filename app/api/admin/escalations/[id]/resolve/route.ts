import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminActionType } from '@prisma/client'

const VALID_RESOLUTION_TYPES = new Set([
  'chunk_updated',
  'misconception_added',
  'prompt_fix',
  'cached_answer',
])

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()
  const resolutionType: string | undefined = body.resolutionType
  const resolutionNote: string | undefined = body.resolutionNote

  if (!resolutionType || !VALID_RESOLUTION_TYPES.has(resolutionType)) {
    return NextResponse.json(
      { error: 'resolutionType must be one of: chunk_updated, misconception_added, prompt_fix, cached_answer' },
      { status: 400 },
    )
  }

  const escalation = await prisma.doubtEscalation.findUnique({ where: { id } })
  if (!escalation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (escalation.resolvedAt) {
    return NextResponse.json({ error: 'Already resolved' }, { status: 409 })
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.doubtEscalation.update({
      where: { id },
      data: {
        resolvedAt: now,
        resolutionType,
        resolutionNote: resolutionNote ?? null,
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'DoubtEscalation',
        targetId: id,
        action: AdminActionType.DOUBT_RESOLVE,
        newValue: { resolutionType, resolutionNote: resolutionNote ?? null },
      },
    }),
  ])

  return NextResponse.json({ resolved: true })
}
