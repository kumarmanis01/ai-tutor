/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  await requireAdmin()
  const workers = await prisma.workerLifecycle.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 })
  return NextResponse.json(workers)
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  const body = await req.json().catch(() => ({} as any))

  const action = String(body.action || '').toLowerCase()

  if (action === 'start') {
    const type = String(body.type || 'content-hydration')
    if (!type || type.length === 0) return NextResponse.json({ error: 'type required' }, { status: 400 })

    const created = await prisma.workerLifecycle.create({
      data: {
        type,
        host: body.host || null,
        pid: body.pid ?? null,
        status: 'STARTING',
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        meta: body.meta ?? null,
      },
    })

    await prisma.auditLog.create({ data: { userId: session.user.id, action: 'WORKER_START', details: { reason: body.reason ?? null, workerId: created.id } } })

    // Return minimal response the orchestrator / CLI expects
    return NextResponse.json({ lifecycleId: created.id, type: created.type })
  }

  if (action === 'stop') {
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const drain = body.drain === undefined ? true : Boolean(body.drain)
    const update = await prisma.workerLifecycle.update({ where: { id }, data: { status: drain ? 'DRAINING' : 'STOPPED', stoppedAt: drain ? null : new Date() } })

    await prisma.auditLog.create({ data: { userId: session.user.id, action: 'WORKER_STOP', details: { reason: body.reason ?? null, workerId: id, drain } } })

    return NextResponse.json(update)
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
