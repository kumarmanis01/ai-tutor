/**
 * POST /api/admin/jobs/[id]/cancel
 * Cancels a running/pending/paused HydrationJob and all its active children.
 * Also deletes any unsent Outbox rows so cancelled jobs are never dispatched to BullMQ.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const { id } = await params

  const job = await prisma.hydrationJob.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 })

  const cancellable = ['running', 'pending', 'paused']
  if (!cancellable.includes(job.status)) {
    return NextResponse.json({ error: 'job_not_cancellable', status: job.status }, { status: 409 })
  }

  // Collect all affected job IDs before cancelling so we can clean up their Outbox rows
  const affectedJobs = await prisma.hydrationJob.findMany({
    where: {
      OR: [{ id }, { rootJobId: id }],
      status: { in: ['running', 'pending', 'paused'] },
    },
    select: { id: true },
  })
  const affectedIds = affectedJobs.map((j) => j.id)

  const { count } = await prisma.hydrationJob.updateMany({
    where: {
      OR: [{ id }, { rootJobId: id }],
      status: { in: ['running', 'pending', 'paused'] },
    },
    data: { status: 'cancelled', lockedAt: null },
  })

  // Delete unsent Outbox rows for all cancelled jobs so they are never dispatched.
  // Workers that have already claimed the BullMQ job will fail the atomic claim
  // (status is now 'cancelled', not 'pending') and exit cleanly.
  if (affectedIds.length > 0) {
    for (const jobId of affectedIds) {
      await prisma.outbox.deleteMany({
        where: {
          sentAt: null,
          meta: { path: ['hydrationJobId'], equals: jobId },
        },
      }).catch((e) =>
        logger.warn('[admin/jobs/cancel] failed to delete outbox rows', { jobId, error: e })
      )
    }
  }

  logger.info('[admin/jobs/cancel] Job cancelled', {
    event: 'hydration_job_cancelled',
    context: { jobId: id, affectedRows: count, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, cancelled: count })
}
