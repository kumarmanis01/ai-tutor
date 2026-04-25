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

    if (job.status !== 'paused') {
      return NextResponse.json(
        { code: 'INVALID_STATE', message: `Job is not paused (current state: ${job.status})` },
        { status: 400 }
      );
    }

    // Resume root job and all paused child jobs back to pending
    await prisma.hydrationJob.updateMany({
      where: {
        OR: [{ id: jobId }, { rootJobId: jobId }],
        status: 'paused',
      },
      data: { status: 'pending' },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'HydrationJob',
        targetId: jobId,
        action: 'JOB_RESUME',
        previousValue: { status: 'paused' },
        newValue: { status: 'pending' },
      },
    });

    logger.info('[hydrateAll/resume] Job resumed', {
      event: 'job_resume',
      context: { jobId, adminId: session.user.id },
    });

    return NextResponse.json({ ok: true, jobId, status: 'pending' });
  } catch (err) {
    logger.error('[hydrateAll/resume] Failed to resume job', {
      event: 'job_resume_error',
      context: { jobId, error: String(err) },
    });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to resume job' },
      { status: 500 }
    );
  }
}
