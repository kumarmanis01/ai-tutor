import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { QualityFlag, AdminActionType } from '@prisma/client'

const VALID_FLAGS = new Set<string>(Object.values(QualityFlag))

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sessionId } = params
  const body = await req.json().catch(() => ({}))
  const { turnId, flag, note } = body as { turnId?: string; flag?: string; note?: string }

  if (!turnId) return NextResponse.json({ error: 'turnId is required' }, { status: 400 })
  if (!flag || !VALID_FLAGS.has(flag)) {
    return NextResponse.json(
      { error: `flag must be one of: ${[...VALID_FLAGS].join(', ')}` },
      { status: 400 },
    )
  }

  await prisma.$transaction([
    prisma.aITutorTurnLog.update({
      where: { id: turnId },
      data: { qualityFlag: flag as QualityFlag, qualityNote: note ?? null },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'AITutorTurnLog',
        targetId: turnId,
        action: AdminActionType.CONTENT_APPROVE,
        newValue: { flag, note: note ?? null, sessionId },
      },
    }),
  ])

  return NextResponse.json({ flagged: true })
}
