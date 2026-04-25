/**
 * POST /api/admin/content/retry
 *
 * Resets failed/cancelled HydrationJob(s) back to pending so the worker picks
 * them up again. Resets the root job AND all its children in one query.
 *
 * Body: { jobId: string }
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: 'missing_fields', required: ['jobId'] }, { status: 400 });
  }

  const job = await prisma.hydrationJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, subjectId: true },
  });
  if (!job) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
  }

  // Reset root job and all child jobs that are failed or cancelled
  const { count } = await prisma.hydrationJob.updateMany({
    where: {
      OR: [{ id: jobId }, { rootJobId: jobId }],
      status: { in: ['failed', 'cancelled'] },
    },
    data: { status: 'pending', lastError: null, attempts: 0, lockedAt: null },
  });

  logger.info('[admin/content/retry] Job reset to pending', {
    event: 'hydration_job_retry',
    context: { jobId, resetCount: count, adminId: session.user?.id },
  });

  return NextResponse.json({ ok: true, resetCount: count });
}
