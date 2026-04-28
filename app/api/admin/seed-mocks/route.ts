/**
 * POST /api/admin/seed-mocks
 * Body: { minPer?: number, dryRun?: boolean, subjectId?: string }
 * Admin-only endpoint to schedule or preview seeding of MockExam records.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { enqueueSeedMocks } from '@/jobs/seedMocks';
import { prisma } from '@/lib/prisma';
import { ensureMinimumMocks } from '@/lib/mock/ensureMocks';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const minPer = typeof body.minPer === 'number' ? body.minPer : 5;
  const dryRun = !!body.dryRun;
  const subjectId =
    typeof body.subjectId === 'string' && body.subjectId ? body.subjectId : undefined;

  // If dryRun requested, run locally (no writes) and return concise summary
  if (dryRun) {
    try {
      const res = await ensureMinimumMocks({ minPer, dryRun: true });
      return NextResponse.json({
        ok: true,
        dryRun: true,
        createdCount: res.created.length,
        preview: res.created.slice(0, 50),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  // Enqueue a background job for the worker to execute
  try {
    const enqueueRes = await enqueueSeedMocks({
      minPer,
      subjectId,
      operatorId: (session?.user as any)?.id,
      dryRun: false,
    });

    // create an audit row for traceability
    try {
      await prisma.auditLog.create({
        data: {
          adminId: (session?.user as any)?.id,
          targetEntity: 'SeedMocks',
          targetId: subjectId ?? 'ALL',
          action: 'CONTENT_HYDRATE',
          details: { minPer, queuedBy: (session?.user as any)?.id, jobId: enqueueRes.jobId },
        },
      });
    } catch {}

    return NextResponse.json({ ok: true, queued: true, jobId: enqueueRes.jobId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
