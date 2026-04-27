import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrModerator } from '@/lib/auth'
import makeRetryIntentStore from '@/lib/retryIntent/store'
import { logAuditEvent } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireAdminOrModerator()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId')

  const where: any = {}
  if (jobId) where.sourceJobId = jobId

  const intents = await prisma.retryIntent.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ intents })
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminOrModerator()
    const body = await req.json()
    const { sourceJobId, sourceOutputRef, reasonCode, reasonText } = body || {}
    if (!sourceJobId || !reasonCode || !reasonText) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const store = makeRetryIntentStore(prisma as any)
    const created = await store.createRetryIntent({
      sourceJobId,
      sourceOutputRef,
      reasonCode,
      reasonText,
      approvedBy: session.user.id,
      approvedAt: new Date(),
    })

    // audit
    try {
      logAuditEvent(prisma as any, { action: 'RETRY_INTENT_CREATED', entityId: created.id, metadata: { sourceJobId } })
    } catch {}

    return NextResponse.json({ intent: created })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function PUT() {
  return new Response(null, { status: 405 })
}

export async function PATCH() {
  return new Response(null, { status: 405 })
}

export async function DELETE() {
  return new Response(null, { status: 405 })
}
