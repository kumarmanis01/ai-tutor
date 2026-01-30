/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { submitJob } from '@/lib/execution-pipeline/submitJob';
import { enqueueSyllabusHydration } from '@/hydrators/hydrateSyllabus';
import { getServerSessionForHandlers } from '@/lib/session';
import { JobStatus } from '@/lib/ai-engine/types';
import { formatLastError, FailureCode } from '@/lib/failureCodes';

export async function POST(req: Request, { params }: { params: { id: string; action: string } }) {
  try {
    const { id, action } = params;
    if (!id || !action) return NextResponse.json({ error: 'missing parameters' }, { status: 400 });

    const job = await prisma.executionJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Require authenticated admin/moderator session for actions (defense-in-depth)
    const session = await getServerSessionForHandlers();
    const role = session?.user?.role ?? null;
    if (!role || (role !== 'admin' && role !== 'moderator')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    if (action === 'cancel') {
      // Only allow cancelling pending jobs per guardrails
      if (job.status !== JobStatus.Pending) {
        return NextResponse.json({ error: 'cannot_cancel', message: 'Only pending jobs can be cancelled' }, { status: 400 });
      }

      const adminId = session?.user?.id ?? null;

      logger.info('cancel action requested by admin', { jobId: id, prevStatus: job.status, actor: adminId });
      const le = formatLastError(FailureCode.DB_WRITE_FAILED, 'cancelled_by_admin');
      const updated = await prisma.executionJob.update({ where: { id }, data: { status: JobStatus.Cancelled, lastError: le } });
      logger.info('job status updated', { jobId: id, prevStatus: job.status, newStatus: updated.status });
      try {
        await prisma.jobExecutionLog.create({ data: { jobId: id, event: 'CANCELLED', prevStatus: job.status, newStatus: updated.status, message: le, meta: { actor: adminId } } });
      } catch (e) {
        logger?.warn?.('admin.cancel: failed to write JobExecutionLog', { err: e, jobId: id });
      }
      await prisma.auditLog.create({ data: { userId: adminId, action: 'cancel_job', details: { jobId: id, prevStatus: job.status }, createdAt: new Date() } });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === 'retry') {
      // Retry creates a new job (do not mutate old job). Allowed when previous job failed or cancelled.
      if (job.status !== JobStatus.Failed && job.status !== JobStatus.Cancelled) {
        return NextResponse.json({ error: 'cannot_retry', message: 'Only failed or cancelled jobs can be retried' }, { status: 400 });
      }

      logger.info('retry action requested by admin', { originalJobId: id, actor: session?.user?.id ?? null });
      const result = await submitJob({ jobType: job.jobType as any, entityType: job.entityType as any, entityId: job.entityId, payload: job.payload ?? {}, maxAttempts: job.maxAttempts ?? 5 });
      logger.info('retry created new job', { originalJobId: id, newJobId: result.jobId, existing: result.existing });

      try {
        await prisma.jobExecutionLog.create({ data: { jobId: id, event: 'RETRY', prevStatus: job.status, newStatus: 'retrying', meta: { newJobId: result.jobId, actor: session?.user?.id ?? null } } });
      } catch (e) {
        logger?.warn?.('admin.retry: failed to write JobExecutionLog', { err: e, jobId: id });
      }

      const adminId = session?.user?.id ?? null;
      await prisma.auditLog.create({ data: { userId: adminId, action: 'retry_job', details: { originalJobId: id, newJobId: result.jobId }, createdAt: new Date() } });

      return NextResponse.json({ jobId: result.jobId, existing: result.existing });
    }

    if (action === 'requeue') {
      // Re-enqueue the hydrator/worker for this job. Prefer reusing an existing
      // hydrationJob if present, otherwise create one via the hydrator helper.
      if (job.status !== JobStatus.Failed) {
        return NextResponse.json({ error: 'cannot_requeue', message: 'Only failed jobs can be requeued' }, { status: 400 });
      }

      logger.info('requeue action requested by admin', { originalJobId: id, actor: session?.user?.id ?? null });

      // If the execution job payload already contains a hydrationJobId, create an outbox
      // for the existing HydrationJob to enqueue it again. Otherwise attempt to create
      // a new HydrationJob using the job payload (syllabus hydrator helper).
      try {
        const payload = (job.payload as any) ?? {};
        if (payload.hydrationJobId) {
          // Create an outbox entry for the existing hydration job so dispatcher will enqueue it
          await prisma.outbox.create({ data: { queue: 'content-hydration', payload: { type: 'SYLLABUS', payload: { jobId: payload.hydrationJobId } }, meta: { hydrationJobId: payload.hydrationJobId } } });
          await prisma.jobExecutionLog.create({ data: { jobId: id, event: 'REQUEUE', prevStatus: job.status, newStatus: job.status, meta: { hydrationJobId: payload.hydrationJobId, actor: session?.user?.id ?? null } } }).catch(()=>{});
          await prisma.auditLog.create({ data: { userId: session?.user?.id ?? null, action: 'requeue_job', details: { jobId: id, hydrationJobId: payload.hydrationJobId }, createdAt: new Date() } });
          return NextResponse.json({ ok: true, requeued: true });
        }

        // Try to create a new hydration job using hydrator helper
        const board = payload.boardId ?? payload.board ?? null;
        const grade = payload.classId ?? payload.grade ?? null;
        const subject = payload.subject ?? null;
        const subjectId = payload.subjectId ?? null;
        const language = payload.language ?? null;

        const res = await enqueueSyllabusHydration({ board, grade, subject, subjectId, language });
        await prisma.jobExecutionLog.create({ data: { jobId: id, event: 'REQUEUE', prevStatus: job.status, newStatus: job.status, meta: { hydratorResult: res, actor: session?.user?.id ?? null } } }).catch(()=>{});
        await prisma.auditLog.create({ data: { userId: session?.user?.id ?? null, action: 'requeue_job', details: { jobId: id, hydratorResult: res }, createdAt: new Date() } });

        return NextResponse.json({ ok: true, requeued: true, result: res });
      } catch (e) {
        logger?.error?.('admin.requeue: failed', { err: e, jobId: id });
        return NextResponse.json({ error: 'requeue_failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err) {
    logger?.error?.('POST /api/admin/content-engine/jobs/[id]/[action] error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
