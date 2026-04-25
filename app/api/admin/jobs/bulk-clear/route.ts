/**
 * POST /api/admin/jobs/bulk-clear
 *
 * Deletes all non-active root-level HydrationJobs (completed, cancelled, failed)
 * and their descendant jobs (Level 1/2/3 children sharing the same rootJobId).
 *
 * Active jobs (running, pending, paused) are never touched.
 *
 * Auth: admin role required.
 * Returns: { ok: true, deleted: number }
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CLEARABLE_STATUSES = ['completed', 'cancelled', 'failed'] as const;

export async function POST(_req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  // Find all non-active root jobs
  const rootJobs = await prisma.hydrationJob.findMany({
    where: {
      hierarchyLevel: 0,
      status: { in: [...CLEARABLE_STATUSES] },
    },
    select: { id: true, status: true },
  });

  if (rootJobs.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: 'No stale jobs to clear.' });
  }

  const rootIds = rootJobs.map((j) => j.id);

  // Delete children first (Level 1/2/3 jobs whose rootJobId is in the set),
  // then the root jobs. Done outside a transaction to avoid large tx timeouts.
  const childResult = await prisma.hydrationJob.deleteMany({
    where: {
      rootJobId: { in: rootIds },
      hierarchyLevel: { not: 0 },
    },
  });

  const rootResult = await prisma.hydrationJob.deleteMany({
    where: { id: { in: rootIds } },
  });

  const total = childResult.count + rootResult.count;

  logger.info('[admin/jobs/bulk-clear] stale jobs deleted', {
    event: 'bulk_clear_jobs',
    context: {
      rootDeleted: rootResult.count,
      childrenDeleted: childResult.count,
      adminId: session.user?.id,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: total,
    message: `Cleared ${rootResult.count} job${rootResult.count !== 1 ? 's' : ''} (+ ${childResult.count} child jobs).`,
  });
}
