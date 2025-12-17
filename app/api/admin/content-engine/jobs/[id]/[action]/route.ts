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
import { getServerSessionForHandlers } from '@/lib/session';
import { JobStatus } from '@/lib/ai-engine/types';

export async function POST(req: Request, { params }: { params: { id: string; action: string } }) {
  try {
    const { id, action } = params;
    if (!id || !action) return NextResponse.json({ error: 'missing parameters' }, { status: 400 });

    const job = await prisma.executionJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (action === 'cancel') {
      // Only allow cancelling pending jobs per guardrails
      if (job.status !== JobStatus.Pending) {
        return NextResponse.json({ error: 'cannot_cancel', message: 'Only pending jobs can be cancelled' }, { status: 400 });
      }

      const session = await getServerSessionForHandlers();
      const adminId = session?.user?.id ?? null;

      logger.info('cancel action requested by admin', { jobId: id, prevStatus: job.status });
      const updated = await prisma.executionJob.update({ where: { id }, data: { status: JobStatus.Cancelled, lastError: 'Cancelled by admin' } });
      logger.info('job status updated', { jobId: id, prevStatus: job.status, newStatus: updated.status });
      await prisma.auditLog.create({ data: { userId: adminId, action: 'cancel_job', details: { jobId: id, prevStatus: job.status }, createdAt: new Date() } });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === 'retry') {
      // Retry creates a new job (do not mutate old job). Allowed when previous job failed.
      if (job.status !== JobStatus.Failed) {
        return NextResponse.json({ error: 'cannot_retry', message: 'Only failed jobs can be retried' }, { status: 400 });
      }

      logger.info('retry action requested by admin', { originalJobId: id });
      const result = await submitJob({ jobType: job.jobType as any, entityType: job.entityType as any, entityId: job.entityId, payload: job.payload ?? {}, maxAttempts: job.maxAttempts ?? 5 });
      logger.info('retry created new job', { originalJobId: id, newJobId: result.jobId, existing: result.existing });

      const session = await getServerSessionForHandlers();
      const adminId = session?.user?.id ?? null;
      await prisma.auditLog.create({ data: { userId: adminId, action: 'retry_job', details: { originalJobId: id, newJobId: result.jobId }, createdAt: new Date() } });

      return NextResponse.json({ jobId: result.jobId, existing: result.existing });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err) {
    logger?.error?.('POST /api/admin/content-engine/jobs/[id]/[action] error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
