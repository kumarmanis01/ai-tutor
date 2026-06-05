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
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants'

// Jobs locked for more than 10 minutes without an update are considered stuck
const STUCK_THRESHOLD_MS = 10 * 60 * 1000

export async function POST(_req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS)

  // Find stuck jobs before resetting so we can re-enqueue them
  const stuckJobs = await prisma.hydrationJob.findMany({
    where: { status: 'running', lockedAt: { lt: threshold } },
    select: { id: true, jobType: true },
  })

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

  // Re-create Outbox rows so the dispatcher re-enqueues each job to BullMQ.
  // The original Outbox rows already have sentAt set and won't be re-dispatched.
  for (const job of stuckJobs) {
    const jobTypeName = String(job.jobType).toUpperCase()
    await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: jobTypeName, payload: { jobId: job.id } },
        meta: { hydrationJobId: job.id, source: 'unstick-all' },
      },
    }).catch((e: any) => logger.warn('[admin/jobs/unstick-all] failed to create outbox row', { jobId: job.id, error: e }))
  }

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
