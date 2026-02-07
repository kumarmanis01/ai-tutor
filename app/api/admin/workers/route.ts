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
import { requireAdminOrModerator } from '@/lib/auth'

export async function GET() {
  await requireAdminOrModerator()
  const workers = await prisma.workerLifecycle.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 })
  // Include minimal health indicators for UI: lastHeartbeat age (ms)
  const now = new Date();
  const enriched = workers.map(w => ({
    ...w,
    lastHeartbeatAgeMs: w.lastHeartbeatAt ? now.getTime() - new Date(w.lastHeartbeatAt).getTime() : null,
  }))
  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const session = await requireAdminOrModerator()
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

    // Resolve canonical DB user id for audit safety; fall back to null
    let auditUserId: string | null = null;
    try {
      if (session?.user?.id) {
        const byId = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (byId) auditUserId = byId.id;
      }
      if (!auditUserId && session?.user?.email) {
        const byEmail = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (byEmail) auditUserId = byEmail.id;
      }
    } catch {
      auditUserId = null;
    }

    await prisma.auditLog.create({ data: { userId: auditUserId, action: 'WORKER_START', details: { reason: body.reason ?? null, workerId: created.id } } })

    // Return minimal response the orchestrator / CLI expects
    return NextResponse.json({ lifecycleId: created.id, type: created.type })
  }

  if (action === 'stop') {
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const drain = body.drain === undefined ? true : Boolean(body.drain)
    const update = await prisma.workerLifecycle.update({ where: { id }, data: { status: drain ? 'DRAINING' : 'STOPPED', stoppedAt: drain ? null : new Date() } })

    // Resolve canonical DB user id for audit safety; fall back to null
    let auditUserId2: string | null = null;
    try {
      if (session?.user?.id) {
        const byId2 = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (byId2) auditUserId2 = byId2.id;
      }
      if (!auditUserId2 && session?.user?.email) {
        const byEmail2 = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (byEmail2) auditUserId2 = byEmail2.id;
      }
    } catch {
      auditUserId2 = null;
    }

    await prisma.auditLog.create({ data: { userId: auditUserId2, action: 'WORKER_STOP', details: { reason: body.reason ?? null, workerId: id, drain } } })

    return NextResponse.json(update)
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
