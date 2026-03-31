/**
 * POST /api/admin/jobs/[id]/resume
 * Resumes a paused HydrationJob and all its paused children.
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
  if (job.status !== 'paused') {
    return NextResponse.json({ error: 'job_not_paused', status: job.status }, { status: 409 })
  }

  const { count } = await prisma.hydrationJob.updateMany({
    where: {
      OR: [{ id }, { rootJobId: id }],
      status: 'paused',
    },
    data: { status: 'pending' },
  })

  logger.info('[admin/jobs/resume] Job resumed', {
    event: 'hydration_job_resumed',
    context: { jobId: id, affectedRows: count, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, resumed: count })
}
