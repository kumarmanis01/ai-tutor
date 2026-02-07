/**
 * FILE OBJECTIVE:
 * - API endpoint to submit a "Hydrate All" master job that generates all content
 *   for a board/grade/subject/language combination in sequence:
 *   1. Syllabus → 2. Chapters → 3. Topics → 4. Notes → 5. Questions → 6. Tests
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/hydrate-all/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 *
 * EDIT LOG:
 * - 2026-01-22T07:30:00Z | copilot | Created hydrate-all API for cascading content generation
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { submitJob } from '@/lib/execution-pipeline/submitJob';
import { LanguageCode, DifficultyLevel } from '@prisma/client';

interface HydrateAllRequest {
  boardId: string;
  classId: string;
  subjectId: string;
  language: LanguageCode;
  difficulties?: DifficultyLevel[];
}

/**
 * POST /api/admin/content-engine/hydrate-all
 * 
 * Submits a master job that will cascade through all content generation steps:
 * 1. Generate syllabus (chapters + topics) for the subject
 * 2. Generate notes for each topic
 * 3. Generate questions for each topic (all difficulties)
 * 4. Assemble tests for each topic (all difficulties)
 * 
 * The syllabus worker will automatically create HydrationJobs for downstream content
 * when the syllabus completes. This endpoint just kicks off the syllabus generation.
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body: HydrateAllRequest = await req.json();
    const { boardId, classId, subjectId, language, difficulties = ['easy', 'medium', 'hard'] } = body;

    // Validate required fields
    if (!boardId || !classId || !subjectId || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: boardId, classId, subjectId, language' },
        { status: 400 }
      );
    }

    // Validate language
    if (!['en', 'hi'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Supported: en, hi' },
        { status: 400 }
      );
    }

    // Fetch the subject with its hierarchy for validation and logging
    const subject = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      include: {
        class: {
          include: {
            board: true,
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Verify the subject belongs to the specified class and board
    if (subject.classId !== classId || subject.class?.boardId !== boardId) {
      return NextResponse.json(
        { error: 'Subject does not belong to the specified board/class' },
        { status: 400 }
      );
    }

    logger.info('[hydrate-all] Starting full content hydration', {
      adminId: session.user.id,
      board: subject.class?.board?.name,
      grade: subject.class?.grade,
      subject: subject.name,
      language,
      difficulties,
    });

    // Step 1: Submit the syllabus job
    // The syllabus worker will create chapters/topics and automatically queue
    // notes/questions/tests jobs for each topic when it completes.
    const syllabusResult = await submitJob({
      jobType: 'syllabus',
      entityType: 'SUBJECT',
      entityId: subjectId,
      payload: {
        language,
        difficulties,
        cascadeAll: true, // Flag to tell syllabus worker to auto-queue all downstream jobs
      },
      maxAttempts: 3,
    });

    // Resolve the canonical DB user id for auditing. If the session identity
    // doesn't map to a DB user, write a NULL userId to avoid foreign-key errors.
    let auditUserId: string | null = null;
    try {
      if (session.user?.id) {
        const byId = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (byId) auditUserId = byId.id;
      }
      if (!auditUserId && session.user?.email) {
        const byEmail = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (byEmail) auditUserId = byEmail.id;
      }
    } catch {
      // If DB lookup fails for any reason, fall back to null — do not block
      // the hydrate-all flow because of auditing lookup problems.
      auditUserId = null;
    }

    // Create audit log entry (userId may be null)
    await prisma.auditLog.create({
      data: {
        userId: auditUserId,
        action: 'hydrate_all_initiated',
        details: {
          boardId,
          boardName: subject.class?.board?.name,
          classId,
          grade: subject.class?.grade,
          subjectId,
          subjectName: subject.name,
          language,
          difficulties,
          syllabusJobId: syllabusResult.jobId,
          isExisting: syllabusResult.existing,
        },
      },
    });

    logger.info('[hydrate-all] Master job submitted', {
      syllabusJobId: syllabusResult.jobId,
      isExisting: syllabusResult.existing,
      subject: subject.name,
    });

    return NextResponse.json({
      success: true,
      message: syllabusResult.existing
        ? 'Hydration job already in progress'
        : 'Full content hydration initiated',
      jobId: syllabusResult.jobId,
      isExisting: syllabusResult.existing,
      details: {
        board: subject.class?.board?.name,
        grade: subject.class?.grade,
        subject: subject.name,
        language,
        difficulties,
        steps: [
          '1. Generate syllabus (chapters & topics)',
          '2. Generate notes for each topic',
          '3. Generate questions for each topic',
          '4. Assemble tests for each topic',
        ],
      },
    });
  } catch (error) {
    logger.error('[hydrate-all] Failed to initiate hydration', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate hydration' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/content-engine/hydrate-all
 * Returns the available boards, classes, and subjects for the dropdown selectors.
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch all boards with their classes and subjects
    const boards = await prisma.board.findMany({
      where: { lifecycle: 'active' },
      include: {
        classes: {
          where: { lifecycle: 'active' },
          include: {
            subjects: {
              where: { lifecycle: 'active' },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { grade: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      boards,
      languages: ['en', 'hi'],
      difficulties: ['easy', 'medium', 'hard'],
    });
  } catch (error) {
    logger.error('[hydrate-all] Failed to fetch hierarchy', { error });
    return NextResponse.json(
      { error: 'Failed to fetch hierarchy' },
      { status: 500 }
    );
  }
}
