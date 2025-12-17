/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */

import { NextResponse } from 'next/server';
import { submitJob } from '@/lib/execution-pipeline/submitJob';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await requireAdminOrModerator();
    const body = await req.json();

    logger.info('POST /api/admin/content-engine/jobs incoming', { body });
    const { jobType, entityType, entityId, payload: bodyPayload, maxAttempts } = body;

    // If callers send language/ids at top-level (legacy/UI), fold into payload
    const payload = bodyPayload ?? {
      language: body.language ?? undefined,
      boardId: body.boardId ?? undefined,
      classId: body.classId ?? undefined,
      subjectId: body.subjectId ?? undefined,
      chapterId: body.chapterId ?? undefined,
      topicId: body.topicId ?? undefined,
    };

    if (!jobType || !entityType || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await submitJob({ jobType, entityType, entityId, payload, maxAttempts });

    return NextResponse.json({ jobId: result.jobId, existing: result.existing });
  } catch (err) {
    logger?.error?.('POST /api/admin/content-engine/jobs error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// GET /api/admin/content-engine/jobs?limit=20
export async function GET(req: Request) {
  try {
    await requireAdminOrModerator();
    const url = new URL(req.url);
    // Filters
    const status = url.searchParams.get('status') ?? undefined;
    const jobType = url.searchParams.get('jobType') ?? undefined;
    const entityType = url.searchParams.get('entityType') ?? undefined;
    const createdAfter = url.searchParams.get('createdAfter') ? new Date(String(url.searchParams.get('createdAfter'))) : undefined;
    const createdBefore = url.searchParams.get('createdBefore') ? new Date(String(url.searchParams.get('createdBefore'))) : undefined;

    // Pagination: cursor-based using createdAt + id
    const limit = Math.min(Number(url.searchParams.get('limit') || '25') || 25, 100);
    const cursor = url.searchParams.get('cursor') ?? undefined; // expected encoded as `${createdAt.toISOString()}::${id}`

    const q = url.searchParams.get('q') ?? undefined;
    const where: any = {};
    // NOTE: topicId search intentionally excluded.
    // If needed in the future, denormalize `payload.topicId` into a separate column (e.g., `entitySubId`) and index it.
    if (q) {
      // simple search: match job id or entityId
      where.OR = [{ id: q }, { entityId: q }];
    }
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;
    if (entityType) where.entityType = entityType;
    if (createdAfter || createdBefore) where.createdAt = {};
    if (createdAfter) where.createdAt.gte = createdAfter;
    if (createdBefore) where.createdAt.lte = createdBefore;

    // Build cursor condition for Prisma: where createdAt < cursorCreatedAt OR (createdAt == cursorCreatedAt AND id < cursorId)
    let cursorFilter: any = null;
    if (cursor) {
      const [ts, cursorId] = String(cursor).split('::');
      const cursorDate = new Date(ts);
      // Stable pagination: createdAt < cursorDate OR (createdAt == cursorDate AND id < cursorId)
      cursorFilter = {
        OR: [
          { createdAt: { lt: cursorDate } },
          { AND: [{ createdAt: cursorDate }, { id: { lt: cursorId } }] },
        ],
      };
      // Note: using createdAt desc ordering, so cursor points to last seen item's createdAt
    }

    const whereFinal = cursorFilter ? { AND: [where, cursorFilter] } : where;

    const jobs = await prisma.executionJob.findMany({
      where: whereFinal,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (jobs.length > limit) {
      const last = jobs[limit - 1];
      nextCursor = `${last.createdAt.toISOString()}::${last.id}`;
      jobs.splice(limit, jobs.length - limit);
    }

    return NextResponse.json({ jobs, nextCursor });
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/jobs error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
