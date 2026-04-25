/**
 * POST /api/admin/jobs/[id]/pause
 * Pauses a running HydrationJob and all its running children.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const { id } = await params;

  const job = await prisma.hydrationJob.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
  if (job.status !== 'running') {
    return NextResponse.json({ error: 'job_not_running', status: job.status }, { status: 409 });
  }

  const { count } = await prisma.hydrationJob.updateMany({
    where: {
      OR: [{ id }, { rootJobId: id }],
      status: 'running',
    },
    data: { status: 'paused', lockedAt: null },
  });

  logger.info('[admin/jobs/pause] Job paused', {
    event: 'hydration_job_paused',
    context: { jobId: id, affectedRows: count, adminId: session.user?.id },
  });

  return NextResponse.json({ ok: true, paused: count });
}
