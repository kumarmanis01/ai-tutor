/**
 * POST /api/student/diagnostic/trigger-generation
 *
 * Called by DiagnosticWaitingScreen on mount to kick off content generation
 * for subjects that have no pre-seeded content.
 *
 * Behaviour:
 *   phase "questions" -- topics already exist; FEATURE_ONDEMAND_DIAGNOSTIC handles
 *                        question generation on the next page load; no action needed here
 *   phase "topics"    -- syllabus missing; creates a HydrationJob + Outbox so the
 *                        content-hydration worker generates ChapterDef/TopicDef/Questions
 *
 * Idempotent: if a HydrationJob for this subjectId is already pending or running,
 * the existing jobId is returned without creating a duplicate.
 *
 * Body:   { subjectId: string }
 * Auth:   session required -- 401 if missing
 * See:    docs/v2/on-demand-generator.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LanguageCode, DifficultyLevel, JobStatus, JobType } from '@prisma/client';
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants';

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let subjectId: string | undefined;
  try {
    const body = await req.json();
    subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!subjectId) {
    return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
  }

  try {
    // Fast-path: check if content is already ready before doing any heavy work.
    const topicCount = await prisma.topicDef.count({
      where: {
        chapter: { subjectId, lifecycle: 'active' },
        lifecycle: 'active',
      },
    });

    if (topicCount > 0) {
      // Topics exist -- Path A (FEATURE_ONDEMAND_DIAGNOSTIC) handles question
      // generation on the next page load. Return immediately.
      logger.info('[trigger-generation] topics exist, no action needed', {
        event: 'diagnostic.trigger_generation.topics_exist',
        context: { studentId: userId, subjectId },
      });
      return NextResponse.json({ triggered: false, phase: 'questions' });
    }

    // Idempotency: reuse only the root syllabus job for this subject so we
    // don't accidentally block on a non-syllabus or child HydrationJob.
    const existingJob = await prisma.hydrationJob.findFirst({
      where: {
        subjectId,
        jobType: JobType.syllabus,
        hierarchyLevel: 0,
        status: { in: [JobStatus.pending, JobStatus.running] },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existingJob) {
      logger.info('[trigger-generation] hydration already in flight', {
        event: 'diagnostic.trigger_generation.already_running',
        context: { studentId: userId, subjectId, jobId: existingJob.id },
      });
      return NextResponse.json({ triggered: false, phase: 'topics', jobId: existingJob.id });
    }

    // Resolve SubjectDef with board + grade for the HydrationJob payload.
    const subjectDef = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        slug: true,
        class: {
          select: {
            grade: true,
            board: { select: { slug: true } },
          },
        },
      },
    });

    if (!subjectDef) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Student language preference for the content pipeline.
    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const language: LanguageCode = (student?.language as LanguageCode) ?? LanguageCode.en;

    const boardSlug = subjectDef.class.board.slug;
    const grade = subjectDef.class.grade;
    const subjectSlug = subjectDef.slug;

    // Create HydrationJob + Outbox in one transaction for reliable enqueueing.
    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.hydrationJob.create({
        data: {
          jobType: JobType.syllabus,
          board: boardSlug,
          grade,
          subject: subjectSlug,
          subjectId: subjectDef.id,
          rootJobId: null,
          parentJobId: null,
          language,
          difficulty: DifficultyLevel.medium,
          status: JobStatus.pending,
          attempts: 0,
          maxAttempts: 3,
          contentReady: false,
          hierarchyLevel: 0,
          inputParams: {
            triggeredBy: 'student_on_demand',
            studentId: userId,
            boardSlug,
            grade,
            subjectSlug,
            subjectId: subjectDef.id,
          },
        },
      });

      await tx.outbox.create({
        data: {
          queue: CONTENT_HYDRATION_QUEUE,
          payload: {
            type: 'SYLLABUS',
            payload: { jobId: job.id },
          },
          meta: {
            hydrationJobId: job.id,
            subjectId: subjectDef.id,
            triggeredBy: 'student_on_demand',
            studentId: userId,
            boardSlug,
            grade,
            subjectSlug,
          },
        },
      });

      return job;
    });

    logger.info('[trigger-generation] hydration job created', {
      event: 'diagnostic.trigger_generation.created',
      context: { studentId: userId, subjectId, jobId: result.id, boardSlug, grade, subjectSlug },
    });

    return NextResponse.json({ triggered: true, phase: 'topics', jobId: result.id });
  } catch (err) {
    logger.error('[trigger-generation] failed', {
      event: 'diagnostic.trigger_generation.error',
      context: { studentId: userId, subjectId, error: String(err) },
    });
    return NextResponse.json({ error: 'Could not trigger generation' }, { status: 500 });
  }
}
