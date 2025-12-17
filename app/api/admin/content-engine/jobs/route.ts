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

export async function POST(req: Request) {
  try {
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
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '20') || 20, 100);

    const jobs = await prisma.executionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/jobs error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
