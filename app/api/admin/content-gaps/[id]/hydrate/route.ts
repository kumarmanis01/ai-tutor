/**
 * POST /api/admin/content-gaps/:id/hydrate
 *
 * Manually triggers a QUESTIONS hydration job for a detected or hydration_pending gap.
 * Idempotent: if a HydrationJob already exists for the same topicId and is still
 * pending/running, returns the existing job without creating a duplicate.
 *
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ContentGapStatus, JobType } from '@prisma/client';
import { JobStatus } from '@/lib/ai-engine/types';
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  try {
    const gap = await prisma.contentGap.findUnique({
      where: { id },
      select: {
        id: true,
        topicId: true,
        subjectId: true,
        boardSlug: true,
        grade: true,
        difficulty: true,
        status: true,
        topic: {
          select: {
            chapterId: true,
            chapter: {
              select: {
                subject: { select: { name: true, targetLanguage: true } },
              },
            },
          },
        },
      },
    });

    if (!gap) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (gap.status === ContentGapStatus.resolved || gap.status === ContentGapStatus.ignored) {
      return NextResponse.json({ error: 'gap_not_actionable', status: gap.status }, { status: 409 });
    }

    // Idempotency: skip if there is already a pending/running HydrationJob for this topic.
    const existingActive = await prisma.hydrationJob.findFirst({
      where: {
        topicId: gap.topicId,
        jobType: JobType.questions,
        status: { in: [JobStatus.Pending, JobStatus.Running] as any },
      },
      select: { id: true },
    });

    if (existingActive) {
      return NextResponse.json({
        hydrationJobId: existingActive.id,
        note: 'existing_active_job_reused',
      });
    }

    const hydrationJobId = await prisma.$transaction(async (tx) => {
      const hydrationJob = await tx.hydrationJob.create({
        data: {
          jobType: JobType.questions,
          topicId: gap.topicId,
          chapterId: gap.topic.chapterId,
          subjectId: gap.subjectId,
          subject: gap.topic.chapter.subject.name,
          board: gap.boardSlug,
          grade: gap.grade,
          language: (gap.topic.chapter.subject.targetLanguage ?? 'en') as any,
          difficulty: 'easy' as any,
          status: JobStatus.Pending,
          hierarchyLevel: 3,
          attempts: 0,
          maxAttempts: 3,
          inputParams: {
            topicId: gap.topicId,
            chapterId: gap.topic.chapterId,
            source: 'admin-manual-trigger',
            gapId: gap.id,
          },
        },
      });

      await tx.outbox.create({
        data: {
          queue: CONTENT_HYDRATION_QUEUE,
          payload: {
            type: 'QUESTIONS',
            payload: { jobId: hydrationJob.id },
            dedupKey: `content-gap:${gap.topicId}`,
          },
          meta: {
            hydrationJobId: hydrationJob.id,
            topicId: gap.topicId,
            source: 'admin-manual-trigger',
          },
        },
      });

      return hydrationJob.id;
    });

    await prisma.contentGap.update({
      where: { id: gap.id },
      data: { status: ContentGapStatus.hydration_pending, hydrationJobId },
    });

    logger.info('admin.content-gap.hydration-triggered', {
      gapId: id,
      topicId: gap.topicId,
      difficulty: gap.difficulty,
      hydrationJobId,
      triggeredBy: session.user?.id,
    });

    return NextResponse.json({ hydrationJobId });
  } catch (err) {
    logger.error('admin.content-gap.hydrate.error', {
      gapId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
