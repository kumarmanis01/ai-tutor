import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { QuestionStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = (req.nextUrl.searchParams.get('status') ?? 'QUARANTINED') as QuestionStatus

  const questions = await prisma.question.findMany({
    where: { status },
    include: {
      sessionFlags: { select: { id: true } },
      topic: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ questions })
}
