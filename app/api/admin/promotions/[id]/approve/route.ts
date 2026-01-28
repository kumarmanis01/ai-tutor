import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrModerator } from '@/lib/auth'
import makePromotionService from '@/lib/promotion/service'

export async function POST(_req: Request, { params }: any) {
  try {
    const session = await requireAdminOrModerator()
    const id = params.id
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const service = makePromotionService(prisma as any)
    try {
      const pub = await service.approveCandidate(id, session.user.id)
      return NextResponse.json({ published: pub })
    } catch (err: any) {
      if ((err?.message ?? '').includes('already approved')) return NextResponse.json({ error: 'already_approved' }, { status: 409 })
      if ((err?.message ?? '').includes('rejected')) return NextResponse.json({ error: 'rejected' }, { status: 400 })
      return NextResponse.json({ error: 'failed' }, { status: 400 })
    }
  } catch (err: any) {
    if ((err?.message ?? '').includes('Unauthorized')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
