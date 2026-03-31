import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSessionForHandlers()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ alive: false })
  }

  // Task worker registers with type='content-hydration' (the BullMQ queue name).
  // Detect liveness by heartbeat freshness (< 60s), not by type string.
  const cutoff = new Date(Date.now() - 60_000)
  const worker = await prisma.workerLifecycle.findFirst({
    where: {
      lastHeartbeatAt: { gte: cutoff },
      NOT: { type: { contains: 'web' } },
    },
    orderBy: { lastHeartbeatAt: 'desc' },
    select: { type: true, lastHeartbeatAt: true },
  }).catch(() => null)

  return NextResponse.json({
    alive: worker !== null,
    type: worker?.type ?? null,
    lastHeartbeatAt: worker?.lastHeartbeatAt?.toISOString() ?? null,
  })
}
