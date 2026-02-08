/**
 * FILE: POST /api/admin/hydrateAll
 *
 * OBJECTIVE:
 * Submit a new HydrateAll job to generate complete educational content
 * for a subject (chapters → topics → notes → questions).
 *
 * ARCHITECTURE:
 * - Uses Outbox pattern for transactional job creation
 * - Creates root HydrationJob with hierarchyLevel=0
 * - Calculates estimates (cost, duration, content counts)
 * - Returns 202 Accepted with jobId for async tracking
 *
 * LINKED DOCS:
 * - /Docs/HYDRATEALL_IMPLEMENTATION_GUIDE.md
 * - /Docs/HYDRATEALL_FINAL_ARCHITECTURE.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LanguageCode, DifficultyLevel, JobStatus, JobType } from '@prisma/client';
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import { incrementCreated } from '@/lib/metrics/hydrateMetrics';

export const dynamic = 'force-dynamic'

// ============================================
// Request/Response Types
// ============================================

interface HydrateAllRequest {
  language: LanguageCode;
  boardCode: string;
  grade: string;
  subjectCode: string;
  options?: {
    generateNotes?: boolean;
    generateQuestions?: boolean;
    difficulties?: DifficultyLevel[];
    questionsPerDifficulty?: number;
    skipValidation?: boolean;
    dryRun?: boolean;
  };
}

interface HydrateAllResponse {
  rootJobId: string;
  status: string;
  estimates: {
    totalChapters: number;
    estimatedTopics: number;
    estimatedNotes: number;
    estimatedQuestions: number;
    estimatedCostUsd: number;
    estimatedDurationMins: number;
  };
  traceId: string;
  createdAt: string;
}

// ============================================
// Cost Estimation Constants
// ============================================

const COST_PER_CHAPTER = 0.05; // GPT-4 API cost estimate
const COST_PER_TOPIC = 0.02;
const COST_PER_NOTE = 0.15;
const COST_PER_QUESTION = 0.03;

const TIME_PER_CHAPTER_MINS = 2;
const TIME_PER_TOPIC_MINS = 1;
const TIME_PER_NOTE_MINS = 5;
const TIME_PER_QUESTION_MINS = 2;

// Average content counts per subject
const AVG_CHAPTERS_PER_SUBJECT = 12;
const AVG_TOPICS_PER_CHAPTER = 5;
const NOTES_PER_TOPIC = 1;

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate estimates for content generation
 */
function calculateEstimates(
  options: HydrateAllRequest['options'] = {}
): HydrateAllResponse['estimates'] {
  const {
    generateNotes = true,
    generateQuestions = true,
    difficulties = ['easy', 'medium', 'hard'] as DifficultyLevel[],
    questionsPerDifficulty = 10,
  } = options;

  const totalChapters = AVG_CHAPTERS_PER_SUBJECT;
  const estimatedTopics = totalChapters * AVG_TOPICS_PER_CHAPTER;
  const estimatedNotes = generateNotes ? estimatedTopics * NOTES_PER_TOPIC : 0;
  const estimatedQuestions = generateQuestions
    ? estimatedTopics * difficulties.length * questionsPerDifficulty
    : 0;

  // Cost calculation
  let estimatedCostUsd = 0;
  estimatedCostUsd += totalChapters * COST_PER_CHAPTER; // Syllabus generation
  estimatedCostUsd += estimatedTopics * COST_PER_TOPIC; // Topic details
  estimatedCostUsd += estimatedNotes * COST_PER_NOTE; // Notes generation
  estimatedCostUsd += estimatedQuestions * COST_PER_QUESTION; // Questions

  // Duration calculation (sequential processing assumed)
  let estimatedDurationMins = 0;
  estimatedDurationMins += totalChapters * TIME_PER_CHAPTER_MINS;
  estimatedDurationMins += estimatedTopics * TIME_PER_TOPIC_MINS;
  estimatedDurationMins += estimatedNotes * TIME_PER_NOTE_MINS;
  estimatedDurationMins += estimatedQuestions * TIME_PER_QUESTION_MINS;

  return {
    totalChapters,
    estimatedTopics,
    estimatedNotes,
    estimatedQuestions,
    estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
    estimatedDurationMins: Math.ceil(estimatedDurationMins),
  };
}

/**
 * Validate request payload
 */
function validateRequest(body: any): {
  valid: boolean;
  error?: string;
  data?: HydrateAllRequest;
} {
  const { language, boardCode, grade, subjectCode, options } = body;

  // Required fields
  if (!language || !boardCode || !grade || !subjectCode) {
    return {
      valid: false,
      error: 'Missing required fields: language, boardCode, grade, subjectCode',
    };
  }

  // Validate language
  if (!['en', 'hi'].includes(language)) {
    return { valid: false, error: 'Invalid language. Must be "en" or "hi"' };
  }

  // Validate grade (1-12)
  const gradeNum = parseInt(grade, 10);
  if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
    return { valid: false, error: 'Invalid grade. Must be between 1 and 12' };
  }

  return {
    valid: true,
    data: { language, boardCode, grade, subjectCode, options },
  };
}

/**
 * Find or create subject in database
 */
async function findOrCreateSubject(
  boardCode: string,
  grade: string,
  subjectCode: string,
  _language: LanguageCode
): Promise<{ id: string; name: string } | null> {
  // First, find the board
  let board = await prisma.board.findUnique({
    where: { slug: boardCode.toLowerCase() },
  });

  if (!board) {
    logger.warn(`Board not found: ${boardCode}. Creating placeholder.`);
    board = await prisma.board.create({
      data: {
        name: boardCode,
        slug: boardCode.toLowerCase(),
      },
    });
  }

  // Find the class level
  let classLevel = await prisma.classLevel.findUnique({
    where: {
      boardId_grade: {
        boardId: board.id,
        grade: parseInt(grade, 10),
      },
    },
  });

  if (!classLevel) {
    logger.warn(`ClassLevel not found for grade ${grade}. Creating placeholder.`);
    classLevel = await prisma.classLevel.create({
      data: {
        boardId: board.id,
        grade: parseInt(grade, 10),
        slug: `grade-${grade}`,
      },
    });
  }

  // Find or create subject
  let subject = await prisma.subjectDef.findUnique({
    where: {
      classId_slug: {
        classId: classLevel.id,
        slug: subjectCode.toLowerCase(),
      },
    },
  });

  if (!subject) {
    logger.warn(`Subject not found: ${subjectCode}. Creating placeholder.`);
    subject = await prisma.subjectDef.create({
      data: {
        classId: classLevel.id,
        name: subjectCode,
        slug: subjectCode.toLowerCase(),
      },
    });
  }

  return { id: subject.id, name: subject.name };
}

// ============================================
// GET Handler - List Root Jobs
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const where: any = { rootJobId: null };
    if (status && status !== 'all') {
      where.status = status;
    }

    const jobs = await prisma.hydrationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const jobSummaries = jobs.map((job) => {
      const chaptersExp = job.chaptersExpected || 0;
      const topicsExp = job.topicsExpected || 0;
      const notesExp = job.notesExpected || 0;
      const questionsExp = job.questionsExpected || 0;
      const chaptersComp = job.chaptersCompleted || 0;
      const topicsComp = job.topicsCompleted || 0;
      const notesComp = job.notesCompleted || 0;
      const questionsComp = job.questionsCompleted || 0;

      const totalExp = chaptersExp + topicsExp + notesExp + questionsExp;
      const totalComp = chaptersComp + topicsComp + notesComp + questionsComp;
      const overall = totalExp > 0 ? Math.round((totalComp / totalExp) * 100) : 0;

      return {
        id: job.id,
        status: job.status,
        metadata: {
          board: job.board || 'unknown',
          grade: job.grade || 0,
          subject: job.subject || 'unknown',
          language: job.language || 'en',
        },
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() || null,
        progress: { overall },
        cost: { actual: job.actualCostUsd || null },
      };
    });

    return NextResponse.json({ jobs: jobSummaries });
  } catch (error: any) {
    logger.error('Failed to list HydrateAll jobs', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication & Authorization
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    // 2. Parse & Validate Request
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { language, boardCode, grade, subjectCode, options } = validation.data!;

    // 3. Generate Trace ID for distributed tracing
    const traceId = `hydrate-${nanoid(16)}`;
    logger.info('HydrateAll job submission', {
      traceId,
      language,
      boardCode,
      grade,
      subjectCode,
      userId: session.user.id,
    });

    // 4. Find or Create Subject
    const subject = await findOrCreateSubject(boardCode, grade, subjectCode, language);
    if (!subject) {
      return NextResponse.json({ error: 'Failed to find or create subject' }, { status: 500 });
    }

    // 5. Calculate Estimates
    const estimates = calculateEstimates(options);

    // 6. Check for Dry Run
    if (options?.dryRun) {
      logger.info('Dry run - not creating job', { traceId, estimates });
      return NextResponse.json(
        {
          rootJobId: 'dry-run',
          status: 'dry-run',
          estimates,
          traceId,
          createdAt: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // 7. Create HydrationJob + Outbox in Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create root HydrationJob
      const rootJob = await tx.hydrationJob.create({
        data: {
          jobType: JobType.syllabus, // Start with syllabus generation
          board: boardCode,
          grade: parseInt(grade, 10),
          subject: subjectCode,
          subjectId: subject.id,
          rootJobId: null, // This IS the root
          parentJobId: null,
          language,
          difficulty: DifficultyLevel.medium, // Default
          status: JobStatus.pending,
          attempts: 0,
          maxAttempts: 3,
          contentReady: false,
          // Progress tracking (will be updated by reconciler)
          chaptersExpected: estimates.totalChapters,
          chaptersCompleted: 0,
          topicsExpected: estimates.estimatedTopics,
          topicsCompleted: 0,
          notesExpected: estimates.estimatedNotes,
          notesCompleted: 0,
          questionsExpected: estimates.estimatedQuestions,
          questionsCompleted: 0,
          // Cost tracking
          estimatedCostUsd: estimates.estimatedCostUsd,
          actualCostUsd: 0,
          estimatedDurationMins: estimates.estimatedDurationMins,
          // Metadata
          inputParams: {
            language,
            boardCode,
            grade,
            subjectCode,
            subjectId: subject.id,
            options,
            traceId,
          },
        },
      });

      // Create Outbox entry for transactional queueing
      await tx.outbox.create({
        data: {
          queue: 'content-hydration',
          payload: {
            type: 'SYLLABUS',
            payload: { jobId: rootJob.id },
          },
          meta: {
            hydrationJobId: rootJob.id,
            subjectId: subject.id,
            traceId,
            language,
            boardCode,
            grade,
            subjectCode,
            userId: session.user.id,
          },
        },
      });

      return rootJob;
    });

    // 8. Emit Metrics
    incrementCreated('subject');

    // 9. Create Audit Log
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
      auditUserId = null;
    }

    await prisma.auditLog.create({
      data: {
        userId: auditUserId,
        action: 'HYDRATEALL_SUBMIT',
        details: {
          rootJobId: result.id,
          boardCode,
          grade,
          subjectCode,
          language,
          estimates,
          traceId,
        },
      },
    });

    // 10. Return Response
    logger.info('HydrateAll job created successfully', {
      traceId,
      rootJobId: result.id,
      estimates,
    });

    return NextResponse.json(
      {
        rootJobId: result.id,
        status: 'pending',
        estimates,
        traceId,
        createdAt: result.createdAt.toISOString(),
      } as HydrateAllResponse,
      { status: 202 } // Accepted
    );
  } catch (error: any) {
    logger.error('HydrateAll submission failed', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
