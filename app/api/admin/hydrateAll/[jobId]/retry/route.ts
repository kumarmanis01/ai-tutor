/**
 * FILE: POST /api/admin/hydrateAll/[jobId]/retry
 *
 * OBJECTIVE:
 * Retry a failed child HydrationJob by resetting it to pending
 * and creating a new Outbox entry for dispatch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { JobStatus } from '@/lib/ai-engine/types';

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch the job
    const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 3. Only failed jobs can be retried
    if (job.status !== JobStatus.Failed) {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried', currentStatus: job.status },
        { status: 400 }
      );
    }

    // 4. Reset job and create Outbox entry in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.hydrationJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.Pending,
          attempts: 0,
          lastError: null,
          lockedAt: null,
          completedAt: null,
        },
      });

      // Create Outbox entry so the dispatcher picks it up
      await tx.outbox.create({
        data: {
          queue: 'content-hydration',
          payload: {
            type: String(job.jobType).toUpperCase(),
            payload: { jobId },
          },
          meta: {
            hydrationJobId: jobId,
            retriedBy: session.user.id,
            retriedAt: new Date().toISOString(),
          },
        },
      });
    });

    // 5. If the root job was marked failed because of this child, reset it to running
    if (job.rootJobId) {
      const rootJob = await prisma.hydrationJob.findUnique({
        where: { id: job.rootJobId },
        select: { status: true },
      });
      if (rootJob?.status === JobStatus.Failed) {
        await prisma.hydrationJob.update({
          where: { id: job.rootJobId },
          data: { status: JobStatus.Running, completedAt: null },
        });
        logger.info('Reset root job to running after child retry', {
          rootJobId: job.rootJobId,
          childJobId: jobId,
        });
      }
    }

    logger.info('Job retried', {
      jobId,
      userId: session.user.id,
      jobType: job.jobType,
    });

    return NextResponse.json({
      jobId,
      previousStatus: 'failed',
      newStatus: 'pending',
      message: 'Job queued for retry',
    });
  } catch (error: any) {
    logger.error('Failed to retry job', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
