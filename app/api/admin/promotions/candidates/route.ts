import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrModerator } from '@/lib/auth'
import makePromotionStore from '@/lib/promotion/store'
import { logAuditEvent } from '@/lib/audit/log'

export async function POST(req: Request) {
  try {
    const session = await requireAdminOrModerator()
    const body = await req.json()
    const { scope, scopeRefId, regenerationJobId, outputRef } = body || {}
    if (!scope || !scopeRefId || !regenerationJobId || !outputRef) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const store = makePromotionStore(prisma as any)
    try {
      const created = await store.createPromotionCandidate({ scope, scopeRefId, regenerationJobId, outputRef, createdBy: session.user.id })
      // audit (store already logs, but double-ensure)
      try { logAuditEvent(prisma as any, { action: 'PROMOTION_CANDIDATE_CREATED', entityId: created.id, actorId: session.user.id, metadata: { scope, scopeRefId } }) } catch {}
      return NextResponse.json({ candidate: created })
    } catch (err: any) {
      if ((err?.message ?? '').includes('unique') || (err?.message ?? '').includes('already exists')) return NextResponse.json({ error: 'already_exists' }, { status: 409 })
      throw err
    }
  } catch (err: any) {
    if ((err?.message ?? '').includes('Unauthorized')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

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
