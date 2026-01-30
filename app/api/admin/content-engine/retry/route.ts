import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { JobStatus } from '@/lib/ai-engine/types'
import { randomUUID } from 'crypto'

/**
 * Admin retry endpoint for HydrationJob
 * POST body: { jobId: string }
 * Behavior:
 * - Validate caller is admin
 * - Validate job exists and status === 'failed' and attempts < maxAttempts
 * - Create a NEW HydrationJob copying non-audit fields, attempts reset
 * - Preserve parentJobId and rootJobId references
 * - Do NOT mutate old job
 * - Return new job id
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const jobId = body?.jobId
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

    const old = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
    if (!old) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (old.status !== 'failed') return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 })
    if ((old.attempts ?? 0) >= (old.maxAttempts ?? 3)) return NextResponse.json({ error: 'Max attempts reached' }, { status: 400 })

    // Only certain job types are retryable (leaf jobs). Protect parents like syllabus.
    const retryable: string[] = ['notes', 'questions', 'tests', 'assemble']
    if (!retryable.includes(old.jobType)) return NextResponse.json({ error: 'Job type not retryable' }, { status: 400 })

    // Prepare new job data copying allowed fields deterministically
    const newAttempts = (old.attempts ?? 0) + 1
    const generatedId = randomUUID()
    const copyFields: any = {
      id: generatedId,
      jobType: old.jobType,
      parentJobId: old.parentJobId || null,
      rootJobId: old.rootJobId || generatedId,
      entityType: (old as any).entityType || null,
      entityId: (old as any).entityId || null,
      board: old.board || null,
      grade: old.grade ?? null,
      subject: old.subject || null,
      subjectId: (old as any).subjectId || null,
      chapterId: old.chapterId || null,
      topicId: old.topicId || null,
      language: old.language || null,
      difficulty: old.difficulty || null,
      status: JobStatus.Pending,
      attempts: newAttempts,
      maxAttempts: old.maxAttempts ?? 3,
    }

    const created = await prisma.hydrationJob.create({ data: copyFields })

    // Create Outbox entry so workers will pick up the NEW job (never reference the old job)
    try {
      const payloadType = ((): string => {
        switch (old.jobType) {
          case 'notes':
            return 'NOTES'
          case 'questions':
            return 'QUESTIONS'
          case 'tests':
            return 'ASSEMBLE_TEST'
          case 'assemble':
            return 'ASSEMBLE_TEST'
          case 'syllabus':
          default:
            return String(old.jobType).toUpperCase()
        }
      })()

      await prisma.outbox.create({ data: { queue: 'content-hydration', payload: { type: payloadType, payload: { jobId: created.id } }, meta: { hydrationJobId: created.id, retriedFrom: old.id } } })
    } catch (e) {
      logger.warn('retry: failed to create outbox row', { error: String(e), newJobId: created.id })
    }

    // Emit an audit JobExecutionLog for the retry creation (do NOT mutate old job)
    try {
      await prisma.jobExecutionLog.create({ data: { jobId: created.id, event: 'RETRY_CREATED', prevStatus: old.status, newStatus: created.status, meta: { retriedFrom: old.id, retryBy: session.user.id } } })
    } catch (e) {
      logger.warn('retry: failed to write jobExecutionLog', { error: String(e), jobId: created.id })
    }

    // Parent remains untouched; reconciler will observe the new child when appropriate
    return NextResponse.json({ success: true, newJobId: created.id })
  } catch (e: any) {
    logger.error('retry: failed', { error: String(e) })
    return NextResponse.json({ error: e?.message ?? 'retry failed' }, { status: 500 })
  }
}
