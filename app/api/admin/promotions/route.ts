import { NextResponse } from 'next/server'
import { requireAdminOrModerator } from '@/lib/auth'
import makePromotionStore from '@/lib/promotion/store'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    await requireAdminOrModerator()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const scope = url.searchParams.get('scope')
  const refId = url.searchParams.get('refId')

  const store = makePromotionStore(prisma as any)
  const list = await store.listCandidatesByScope(scope ?? undefined as any, refId ?? undefined)
  return NextResponse.json({ candidates: list })
}
