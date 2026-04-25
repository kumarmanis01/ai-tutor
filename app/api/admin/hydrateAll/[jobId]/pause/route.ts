import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin')
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  const { jobId } = await params;

  try {
    const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
    if (!job)
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });

    if (job.status !== 'running' && job.status !== 'pending') {
      return NextResponse.json(
        { code: 'INVALID_STATE', message: `Cannot pause job in state: ${job.status}` },
        { status: 400 }
      );
    }

    // Pause the root job and all pending/running child jobs
    await prisma.hydrationJob.updateMany({
      where: {
        OR: [{ id: jobId }, { rootJobId: jobId }],
        status: { in: ['running', 'pending'] },
      },
      data: { status: 'paused' },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'HydrationJob',
        targetId: jobId,
        action: 'JOB_PAUSE',
        previousValue: { status: job.status },
        newValue: { status: 'paused' },
      },
    });

    logger.info('[hydrateAll/pause] Job paused', {
      event: 'job_pause',
      context: { jobId, adminId: session.user.id },
    });

    return NextResponse.json({ ok: true, jobId, status: 'paused' });
  } catch (err) {
    logger.error('[hydrateAll/pause] Failed to pause job', {
      event: 'job_pause_error',
      context: { jobId, error: String(err) },
    });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to pause job' },
      { status: 500 }
    );
  }
}
