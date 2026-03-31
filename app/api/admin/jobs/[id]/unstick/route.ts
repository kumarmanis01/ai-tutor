/**
 * POST /api/admin/jobs/[id]/unstick
 *
 * Resets a single HydrationJob that is stuck in RUNNING state back to PENDING
 * so the task worker can reclaim it. Only operates on jobs with status=running
 * and lockedAt older than STUCK_THRESHOLD_MS.
 *
 * Auth: admin role required.
 * Returns: { ok: true }
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const STUCK_THRESHOLD_MS = 10 * 60 * 1000

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
    select: { id: true, status: true, lockedAt: true },
  })

  if (!job) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (job.status !== 'running') {
    return NextResponse.json(
      { error: `Job is ${job.status}, not running -- nothing to unstick.` },
      { status: 400 }
    )
  }

  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS)
  if (job.lockedAt && job.lockedAt > threshold) {
    return NextResponse.json(
      { error: `Job was locked ${Math.round((Date.now() - job.lockedAt.getTime()) / 60000)} min ago -- may still be processing. Wait 10 minutes before unsticking.` },
      { status: 400 }
    )
  }

  await prisma.hydrationJob.update({
    where: { id },
    data: { status: 'pending', lockedAt: null },
  })

  logger.info('[admin/jobs/unstick] reset stuck running job to pending', {
    event: 'unstick_job',
    context: { jobId: id, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, message: `Job reset to pending. Start the task worker to process it.` })
}
