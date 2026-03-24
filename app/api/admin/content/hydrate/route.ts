/**
 * POST /api/admin/content/hydrate
 *
 * Triggers the HydrateAll syllabus pipeline for a given subject.
 *
 * Body: { subjectId, board, grade, language }
 * Auth: admin role required.
 * Guards:
 *   1. SubjectDef must exist for subjectId
 *   2. No PENDING or RUNNING job for this subjectId → 409
 * Actions:
 *   1. Calls enqueueSyllabusHydration (creates HydrationJob + Outbox entry)
 *   2. Writes AuditLog (action: CONTENT_HYDRATE, targetEntity: 'HydrationJob')
 * Returns: { ok: true, jobId: string }
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { enqueueSyllabusHydration } from '@/hydrators/hydrateSyllabus'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  // session check → role check → business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { subjectId?: string; board?: string; grade?: number; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { subjectId, board, grade, language } = body
  if (!subjectId || !board || grade == null) {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId', 'board', 'grade'] }, { status: 400 })
  }

  // Guard 1: SubjectDef must exist
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true, slug: true, class: { select: { grade: true, board: { select: { slug: true } } } } },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  // Guard 2: no active job -- enqueueSyllabusHydration checks internally and returns created:false
  const result = await enqueueSyllabusHydration({
    board,
    grade: Number(grade),
    subject: subject.name,
    subjectId,
    language: language ?? 'en',
  })

  if (!result.created) {
    // Translate internal reason codes to HTTP responses
    if (result.reason === 'job_already_queued') {
      return NextResponse.json(
        { error: 'conflict', message: 'A hydration job is already pending or running for this subject.' },
        { status: 409 },
      )
    }
    if (result.reason === 'hydration_paused') {
      return NextResponse.json({ error: 'hydration_paused', message: 'Hydration is currently paused.' }, { status: 503 })
    }
    return NextResponse.json({ error: result.reason ?? 'enqueue_failed' }, { status: 400 })
  }

  // Write AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        adminId: session.user?.id ?? null,
        targetEntity: 'HydrationJob',
        targetId: result.jobId,
        action: 'CONTENT_HYDRATE',
        newValue: { subjectId, board, grade, language: language ?? 'en', subject: subject.name },
      },
    })
  } catch (auditErr) {
    // Non-fatal -- job was already created; log and continue
    logger.warn('[admin/content/hydrate] failed to write AuditLog', {
      event: 'audit_log_failed',
      context: { jobId: result.jobId, error: String(auditErr) },
    })
  }

  logger.info('[admin/content/hydrate] hydration enqueued', {
    event: 'hydration_enqueued',
    context: { jobId: result.jobId, subjectId, board, grade, adminId: session.user?.id },
  })

  return NextResponse.json({ ok: true, jobId: result.jobId })
}
