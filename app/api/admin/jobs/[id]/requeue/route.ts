/**
 * POST /api/admin/jobs/[id]/requeue
 *
 * Re-enqueues a PENDING or FAILED HydrationJob by creating a fresh Outbox row.
 * The outbox dispatcher picks it up within 5s and adds it to BullMQ.
 *
 * - PENDING: just creates a new Outbox row (status stays PENDING)
 * - FAILED:  resets status to PENDING + creates Outbox row
 * - PAUSED:  delegates to resume logic (sets to PENDING + creates Outbox row)
 *
 * Auth: admin role required.
 * Returns: { ok: true, requeued: number }
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const { id } = await params

  const job = await prisma.hydrationJob.findUnique({
    where: { id },
    select: { id: true, status: true, jobType: true },
  })

  if (!job) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
  }

  const requeueable = ['pending', 'failed', 'paused']
  if (!requeueable.includes(job.status)) {
    return NextResponse.json(
      { error: `Job is ${job.status} -- only pending/failed/paused jobs can be requeued.` },
      { status: 409 }
    )
  }

  // For failed/paused jobs, reset status to pending first
  if (job.status === 'failed' || job.status === 'paused') {
    await prisma.hydrationJob.update({
      where: { id },
      data: { status: 'pending', lockedAt: null, lastError: null },
    })
  }

  // Create a fresh Outbox row. The dispatcher will pick it up within 5s.
  const jobTypeName = String(job.jobType).toUpperCase()
  await prisma.outbox.create({
    data: {
      queue: 'content-hydration',
      payload: { type: jobTypeName, payload: { jobId: id } },
      meta: { hydrationJobId: id, source: 'admin-requeue' },
    },
  })

  logger.info('[admin/jobs/requeue] job requeued', {
    event: 'hydration_job_requeued',
    context: { jobId: id, prevStatus: job.status, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, requeued: 1, message: 'Job requeued. It will be picked up within 5 seconds.' })
}
