/**
 * FILE OBJECTIVE:
 * - GET /api/v1/content/generation/status?jobId=xxx -- returns status by job ID.
 * - GET /api/v1/content/generation/status?topic=xxx -- returns the most recent
 *   PENDING or IN_PROGRESS job for a topic (S3.1: show disabled button if pending).
 *   Auth-guarded. User must be the creator or a subscriber (jobId path).
 *   Topic path returns any active job for the requesting user.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/generation/status/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B4.1 content generation status route
 * - 2026-04-27T00:00:00Z | copilot | added topic-based lookup for S3.1 pending button state
 * - 2026-04-27T00:00:00Z | copilot | switch to getServerSessionForHandlers; scope topic lookup to requesting user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { normalizeTopic } from '@/lib/content-generation/deduplication.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const JOB_SELECT = {
  id: true,
  topic: true,
  subject: true,
  grade: true,
  board: true,
  status: true,
  contentId: true,
  errorMessage: true,
  subscriberIds: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

function formatJob(job: {
  id: string;
  topic: string;
  subject: string;
  grade: number;
  board: string;
  status: string;
  contentId: string | null;
  errorMessage: string | null;
  subscriberIds: string[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    topic: job.topic,
    subject: job.subject,
    grade: job.grade,
    board: job.board,
    status: job.status,
    contentId: job.contentId,
    errorMessage: job.errorMessage,
    subscriberCount: job.subscriberIds.length,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const jobId = req.nextUrl.searchParams.get('jobId');
  const topicRaw = req.nextUrl.searchParams.get('topic');

  // -- topic-based lookup (S3.1 pending button state) --
  if (topicRaw && !jobId) {
    const normalizedTopic = normalizeTopic(topicRaw.trim());
    try {
      const job = await prisma.generationJob.findFirst({
        where: {
          normalizedTopic,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          OR: [{ createdById: userId }, { subscriberIds: { has: userId } }],
        },
        select: JOB_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      if (!job) {
        return NextResponse.json({ job: null });
      }
      return NextResponse.json({ job: formatJob(job) });
    } catch (err: unknown) {
      logger.error('Failed to fetch generation job by topic', { topic: topicRaw, error: err });
      return NextResponse.json(
        { code: 'SERVER_ERROR', message: 'Failed to fetch job status' },
        { status: 500 }
      );
    }
  }

  // -- jobId-based lookup --
  if (!jobId) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'jobId or topic is required' },
      { status: 400 }
    );
  }

  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: JOB_SELECT,
    });

    if (!job) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Generation job not found' },
        { status: 404 }
      );
    }

    const isAuthorized = job.createdById === userId || job.subscriberIds.includes(userId);
    if (!isAuthorized) {
      return NextResponse.json({ code: 'FORBIDDEN', message: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ job: formatJob(job) });
  } catch (err: unknown) {
    logger.error('Failed to fetch generation job status', { jobId, error: err });
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
