/**
 * FILE OBJECTIVE:
 * - Admin endpoint to reset failed/cancelled HydrationJobs back to pending and re-enqueue them.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | fix: create Outbox rows after reset so the outbox dispatcher
 *   re-enqueues each job to BullMQ (previously only updated DB status, worker never picked them up)
 * - 2026-03-08 | claude | initial implementation
 */

/**
 * POST /api/admin/content/retry
 *
 * Resets failed/cancelled HydrationJob(s) back to pending so the worker picks
 * them up again. Resets the root job AND all its children in one query.
 * Creates Outbox rows for each reset job so the dispatcher re-enqueues to BullMQ.
 *
 * Body: { jobId: string }
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { jobId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { jobId } = body
  if (!jobId) {
    return NextResponse.json({ error: 'missing_fields', required: ['jobId'] }, { status: 400 })
  }

  const job = await prisma.hydrationJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, subjectId: true },
  })
  if (!job) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
  }

  // Fetch jobs to reset before updating -- updateMany doesn't return records
  const jobsToReset = await prisma.hydrationJob.findMany({
    where: {
      OR: [{ id: jobId }, { rootJobId: jobId }],
      status: { in: ['failed', 'cancelled'] },
    },
    select: { id: true, jobType: true },
  })

  // Reset root job and all child jobs that are failed or cancelled
  const { count } = await prisma.hydrationJob.updateMany({
    where: {
      OR: [{ id: jobId }, { rootJobId: jobId }],
      status: { in: ['failed', 'cancelled'] },
    },
    data: { status: 'pending', lastError: null, attempts: 0, lockedAt: null },
  })

  // Create Outbox rows so the dispatcher re-enqueues each reset job to BullMQ.
  // Original Outbox rows already have sentAt set and won't be re-dispatched.
  for (const resetJob of jobsToReset) {
    const jobTypeName = String(resetJob.jobType).toUpperCase()
    await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: jobTypeName, payload: { jobId: resetJob.id } },
        meta: { hydrationJobId: resetJob.id, source: 'admin-retry' },
      },
    }).catch((e: unknown) =>
      logger.warn('[admin/content/retry] failed to create outbox row', {
        jobId: resetJob.id,
        error: e,
      })
    )
  }

  logger.info('[admin/content/retry] Job reset to pending and requeued', {
    event: 'hydration_job_retry',
    context: { jobId, resetCount: count, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, resetCount: count })
}
