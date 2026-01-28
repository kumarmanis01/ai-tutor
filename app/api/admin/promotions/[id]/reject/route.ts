import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrModerator } from '@/lib/auth'
import makePromotionService from '@/lib/promotion/service'

export async function POST(req: Request, { params }: any) {
  try {
    const session = await requireAdminOrModerator()
    const id = params.id
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const notes = body?.notes

    const service = makePromotionService(prisma as any)
    try {
      const upd = await service.rejectCandidate(id, session.user.id, notes)
      return NextResponse.json({ candidate: upd })
    } catch (err: any) {
      if ((err?.message ?? '').includes('cannot reject approved')) return NextResponse.json({ error: 'cannot_reject' }, { status: 400 })
      return NextResponse.json({ error: 'failed' }, { status: 400 })
    }
  } catch (err: any) {
    if ((err?.message ?? '').includes('Unauthorized')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
