/**
 * POST /api/admin/jobs/unstick-all
 *
 * Finds all HydrationJobs that are stuck in RUNNING state (lockedAt older than
 * STUCK_THRESHOLD_MS with no recent update) and resets them to PENDING so the
 * task worker can reclaim them on next startup.
 *
 * Safe to call even while the worker is down -- it only touches jobs that have
 * clearly been abandoned (locked > 10 min ago with no update).
 *
 * Auth: admin role required.
 * Returns: { ok: true, unstuck: number }
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Jobs locked for more than 10 minutes without an update are considered stuck
const STUCK_THRESHOLD_MS = 10 * 60 * 1000

export async function POST(_req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS)

  const result = await prisma.hydrationJob.updateMany({
    where: {
      status: 'running',
      lockedAt: { lt: threshold },
    },
    data: {
      status: 'pending',
      lockedAt: null,
    },
  })

  logger.info('[admin/jobs/unstick-all] reset stuck running jobs to pending', {
    event: 'unstick_all_jobs',
    context: { unstuck: result.count, adminId: session.user?.id, thresholdMs: STUCK_THRESHOLD_MS },
  })

  return NextResponse.json({
    ok: true,
    unstuck: result.count,
    message: result.count === 0
      ? 'No stuck jobs found (no running jobs older than 10 minutes).'
      : `Reset ${result.count} stuck job${result.count !== 1 ? 's' : ''} to pending. Start the task worker to process them.`,
  })
}
