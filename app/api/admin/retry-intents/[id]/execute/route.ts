import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrModerator } from '@/lib/auth'
import makeRetryService from '@/lib/regeneration/retryService'
import { logAuditEvent } from '@/lib/audit/log'

export async function POST(_req: Request, { params }: any) {
  try {
    await requireAdminOrModerator()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const id = params.id
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  try {
    const service = makeRetryService(prisma as any)
    const job = await service.createRetryJobFromIntent(id)

    try {
      logAuditEvent(prisma as any, { action: 'RETRY_INTENT_EXECUTED', entityId: id, metadata: { newJobId: job.id } })
    } catch {}

    return NextResponse.json({ job })
  } catch (err: any) {
    if ((err?.message ?? '').includes('already executed')) return NextResponse.json({ error: 'already_executed' }, { status: 409 })
    if ((err?.message ?? '').includes('consume failed') || (err?.message ?? '').includes('not found')) return NextResponse.json({ error: 'failed' }, { status: 400 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
