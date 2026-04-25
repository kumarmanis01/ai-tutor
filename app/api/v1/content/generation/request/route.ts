/**
 * FILE OBJECTIVE:
 * - POST /api/v1/content/generation/request -- enqueues an AI content generation job.
 *   Checks for duplicate requests within 15 minutes before creating a new job.
 *   Auth-guarded. Returns { jobId, isDuplicate }.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/generation/request/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B4.1/B4.2 content generation request route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getContentGenerationQueue } from '@/lib/content-generation/queue';
import {
  normalizeTopic,
  checkDedup,
  setDedup,
  clearDedup,
  addSubscriber,
} from '@/lib/content-generation/deduplication.service';
import { logger } from '@/lib/logger';

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard: session check first, before any DB query
  // Use shared helper to centralize `authOptions` and enable test injection
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  // Parse body
  let topic: string, subject: string, grade: number, board: string, language: string | undefined;
  try {
    const body = (await req.json()) as {
      topic?: unknown;
      subject?: unknown;
      grade?: unknown;
      board?: unknown;
      language?: unknown;
    };

    if (typeof body.topic !== 'string' || !body.topic.trim()) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'topic is required' },
        { status: 400 }
      );
    }
    if (typeof body.subject !== 'string' || !body.subject.trim()) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'subject is required' },
        { status: 400 }
      );
    }
    if (typeof body.grade !== 'number' || body.grade < 1 || body.grade > 12) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'grade must be 1-12' },
        { status: 400 }
      );
    }
    if (typeof body.board !== 'string' || !body.board.trim()) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'board is required' },
        { status: 400 }
      );
    }

    topic = body.topic.trim();
    subject = body.subject.trim();
    grade = body.grade;
    board = body.board.trim();
    language = typeof body.language === 'string' ? body.language : 'en';
  } catch {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const requesterId = session.user.id;
  const normalizedTopic = normalizeTopic(topic);

  // Check for duplicate job within 15-minute window
  const existingJobId = await checkDedup(normalizedTopic);
  if (existingJobId) {
    // Merge this student into the existing job's subscriber list
    await addSubscriber(existingJobId, requesterId);
    logger.info('Content generation dedup: merged with existing job', {
      existingJobId,
      requesterId,
    });
    return NextResponse.json({ jobId: existingJobId, isDuplicate: true });
  }

  // Create new GenerationJob record
  let dbJob;
  try {
    dbJob = await prisma.generationJob.create({
      data: {
        topic,
        normalizedTopic,
        subject,
        grade,
        board,
        language: language === 'hi' ? 'hi' : 'en',
        status: 'PENDING',
        subscriberIds: [requesterId],
        createdById: requesterId,
      },
      select: { id: true },
    });
  } catch (err: unknown) {
    logger.error('Failed to create GenerationJob', { error: err });
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Failed to create generation job' },
      { status: 500 }
    );
  }

  // Enqueue BullMQ job
  try {
    const queue = getContentGenerationQueue();
    await queue.add(
      'generate-content',
      {
        jobId: dbJob.id,
        topic,
        subject,
        grade,
        board,
        language: language as 'en' | 'hi',
        requesterId,
      },
      {
        jobId: dbJob.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      } // Use DB job ID as BullMQ job ID for traceability
    );
    // Register in dedup cache only after enqueue succeeds so a failed enqueue
    // does not cause subsequent requests to be routed to a failed job.
    await setDedup(normalizedTopic, dbJob.id);
  } catch (err: unknown) {
    logger.error('Failed to enqueue content generation job', { jobId: dbJob.id, error: err });
    // Mark job as failed in DB
    await prisma.generationJob
      .update({
        where: { id: dbJob.id },
        data: { status: 'FAILED', errorMessage: 'Failed to enqueue job' },
      })
      .catch(() => {});
    // Ensure dedup does not point to a failed job if an earlier set succeeded
    // (best-effort cleanup)
    try {
      await clearDedup(normalizedTopic);
    } catch {}
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Failed to queue generation job' },
      { status: 500 }
    );
  }

  logger.info('Content generation job created', { jobId: dbJob.id, topic, requesterId });
  return NextResponse.json({ jobId: dbJob.id, isDuplicate: false }, { status: 201 });
}
