import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSessionForHandlers()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ worker: { alive: false }, scheduler: { alive: false } })
  }
  // Determine liveness for both content worker(s) and the scheduler.
  const now = Date.now();
  const workerCutoff = new Date(now - 60_000); // 60s freshness for workers
  const schedulerCutoff = new Date(now - 120_000); // 2m freshness for scheduler

  const workerRow = await prisma.workerLifecycle.findFirst({
    where: {
      lastHeartbeatAt: { gte: workerCutoff },
      NOT: [
        { type: { contains: 'web' } },
        { type: { contains: 'scheduler' } },
      ],
    },
    orderBy: { lastHeartbeatAt: 'desc' },
    select: { type: true, lastHeartbeatAt: true },
  }).catch(() => null)

  const schedulerRow = await prisma.workerLifecycle.findFirst({
    where: {
      type: { contains: 'scheduler' },
      lastHeartbeatAt: { gte: schedulerCutoff },
    },
    orderBy: { lastHeartbeatAt: 'desc' },
    select: { type: true, lastHeartbeatAt: true },
  }).catch(() => null)

  return NextResponse.json({
    worker: {
      alive: workerRow !== null,
      type: workerRow?.type ?? null,
      lastHeartbeatAt: workerRow?.lastHeartbeatAt?.toISOString() ?? null,
    },
    scheduler: {
      alive: schedulerRow !== null,
      type: schedulerRow?.type ?? null,
      lastHeartbeatAt: schedulerRow?.lastHeartbeatAt?.toISOString() ?? null,
    },
  })
}
