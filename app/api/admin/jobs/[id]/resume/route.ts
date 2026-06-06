/**
 * POST /api/admin/jobs/[id]/resume
 * Resumes a paused HydrationJob and all its paused children.
 * Creates Outbox rows for each resumed job so the dispatcher re-enqueues them.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants'

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
  if (job.status !== 'paused') {
    return NextResponse.json({ error: 'job_not_paused', status: job.status }, { status: 409 })
  }

  // Find all paused jobs in this tree before updating so we can re-enqueue each one
  const pausedJobs = await prisma.hydrationJob.findMany({
    where: {
      OR: [{ id }, { rootJobId: id }],
      status: 'paused',
    },
    select: { id: true, jobType: true },
  })

  const { count } = await prisma.hydrationJob.updateMany({
    where: {
      OR: [{ id }, { rootJobId: id }],
      status: 'paused',
    },
    data: { status: 'pending' },
  })

  // Create Outbox rows so the dispatcher re-enqueues each resumed job to BullMQ.
  // Original Outbox rows already have sentAt set and won't be re-dispatched.
  for (const pausedJob of pausedJobs) {
    const jobTypeName = String(pausedJob.jobType).toUpperCase()
    await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: jobTypeName, payload: { jobId: pausedJob.id } },
        meta: { hydrationJobId: pausedJob.id, source: 'resume' },
      },
    }).catch((e: any) =>
      logger.warn('[admin/jobs/resume] failed to create outbox row', {
        jobId: pausedJob.id,
        error: e,
      })
    )
  }

  logger.info('[admin/jobs/resume] Job resumed', {
    event: 'hydration_job_resumed',
    context: { jobId: id, affectedRows: count, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, resumed: count })
}
