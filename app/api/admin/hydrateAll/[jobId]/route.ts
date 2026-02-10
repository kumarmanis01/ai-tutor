/**
 * FILE: GET /api/admin/hydrateAll/[jobId]
 *
 * OBJECTIVE:
 * Retrieve detailed status, progress, and logs for a HydrateAll job.
 *
 * FEATURES:
 * - Real-time progress tracking (chapters, topics, notes, questions)
 * - Cost tracking (estimated vs actual)
 * - Execution timeline with recent logs
 * - Hierarchical view of child jobs
 *
 * LINKED DOCS:
 * - /Docs/HYDRATEALL_IMPLEMENTATION_GUIDE.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================
// Response Types
// ============================================

interface JobProgressResponse {
  jobId: string;
  rootJobId: string | null;
  status: string;
  progress: {
    overall: number;
    levels: {
      chapters: { completed: number; expected: number };
      topics: { completed: number; expected: number };
      notes: { completed: number; expected: number };
      questions: { completed: number; expected: number };
    };
  };
  timing: {
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    estimatedDurationMins: number | null;
    actualDurationMins: number | null;
  };
  cost: {
    estimated: number | null;
    actual: number | null;
  };
  metadata: {
    language: string;
    board: string;
    grade: number;
    subject: string;
    traceId: string | null;
  };
  recentLogs: Array<{
    id: string;
    event: string;
    message: string | null;
    createdAt: string;
  }>;
  childJobSummary?: Record<string, Record<string, number>>; // { notes: { completed: 39, failed: 1 }, questions: { running: 5 } }
  failedJobs?: Array<{
    id: string;
    jobType: string;
    lastError: string | null;
    createdAt: string;
  }>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate overall progress percentage
 */
function calculateOverallProgress(job: any): number {
  const weights = {
    chapters: 0.2,
    topics: 0.2,
    notes: 0.3,
    questions: 0.3,
  };

  let totalProgress = 0;

  if (job.chaptersExpected > 0) {
    totalProgress += (job.chaptersCompleted / job.chaptersExpected) * weights.chapters;
  }

  if (job.topicsExpected > 0) {
    totalProgress += (job.topicsCompleted / job.topicsExpected) * weights.topics;
  }

  if (job.notesExpected > 0) {
    totalProgress += (job.notesCompleted / job.notesExpected) * weights.notes;
  }

  if (job.questionsExpected > 0) {
    totalProgress += (job.questionsCompleted / job.questionsExpected) * weights.questions;
  }

  return Math.round(totalProgress * 100);
}

/**
 * Calculate actual duration in minutes
 */
function calculateActualDuration(startedAt: Date | null, finishedAt: Date | null): number | null {
  if (!startedAt) return null;

  const endTime = finishedAt || new Date();
  const durationMs = endTime.getTime() - startedAt.getTime();
  return Math.ceil(durationMs / (1000 * 60)); // Convert to minutes
}

// ============================================
// GET Handler
// ============================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch Job (without relations for now - schema doesn't have logs relation)
    const job = await prisma.hydrationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 3. Fetch Child Job summary + failed jobs (if this is a root job)
    const childJobSummary: Record<string, Record<string, number>> = {};
    let failedJobs: any[] = [];
    if (!job.rootJobId) {
      // Summary: group by jobType × status
      const grouped = await prisma.hydrationJob.groupBy({
        by: ['jobType', 'status'],
        where: { rootJobId: job.id },
        _count: true,
      });
      for (const row of grouped) {
        const type = row.jobType || 'unknown';
        if (!childJobSummary[type]) childJobSummary[type] = {};
        childJobSummary[type][row.status] = row._count;
      }

      // Only fetch failed jobs (the actionable ones)
      failedJobs = await prisma.hydrationJob.findMany({
        where: { rootJobId: job.id, status: 'failed' },
        select: {
          id: true,
          jobType: true,
          lastError: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // 4. Calculate Progress
    const overallProgress = calculateOverallProgress(job);
    const actualDurationMins = calculateActualDuration(
      job.lockedAt ? new Date(job.lockedAt) : null,
      job.completedAt ? new Date(job.completedAt) : null
    );

    // 5. Extract Metadata from inputParams
    const inputParams = (job as any).inputParams || {};
    const metadata = {
      language: job.language || inputParams.language || 'unknown',
      board: job.board || inputParams.boardCode || 'unknown',
      grade: job.grade || inputParams.grade || 0,
      subject: job.subject || inputParams.subjectCode || 'unknown',
      traceId: inputParams.traceId || null,
    };

    // 6. Build Response
    const response: JobProgressResponse = {
      jobId: job.id,
      rootJobId: job.rootJobId,
      status: job.status,
      progress: {
        overall: overallProgress,
        levels: {
          chapters: {
            completed: job.chaptersCompleted || 0,
            expected: job.chaptersExpected || 0,
          },
          topics: {
            completed: job.topicsCompleted || 0,
            expected: job.topicsExpected || 0,
          },
          notes: {
            completed: job.notesCompleted || 0,
            expected: job.notesExpected || 0,
          },
          questions: {
            completed: job.questionsCompleted || 0,
            expected: job.questionsExpected || 0,
          },
        },
      },
      timing: {
        createdAt: job.createdAt.toISOString(),
        startedAt: job.lockedAt ? new Date(job.lockedAt).toISOString() : null,
        finishedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
        estimatedDurationMins: job.estimatedDurationMins || null,
        actualDurationMins,
      },
      cost: {
        estimated: job.estimatedCostUsd || null,
        actual: job.actualCostUsd || null,
      },
      metadata,
      recentLogs: [],
    };

    // Add child job summary + failed jobs if this is a root job
    if (Object.keys(childJobSummary).length > 0) {
      response.childJobSummary = childJobSummary;
    }
    if (failedJobs.length > 0) {
      response.failedJobs = failedJobs.map((child: any) => ({
        id: child.id,
        jobType: child.jobType,
        lastError: child.lastError,
        createdAt: child.createdAt.toISOString(),
      }));
    }

    // 7. Log Access
    logger.debug('Job progress retrieved', {
      jobId,
      userId: session.user.id,
      status: job.status,
      progress: overallProgress,
    });

    // 8. Return Response
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    logger.error('Failed to retrieve job progress', {
      error: error.message,
      stack: error.stack,
      jobId: params.jobId,
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

// ============================================
// DELETE Handler - Cancel Job
// ============================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch Job
    const job = await prisma.hydrationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 3. Check if job can be cancelled
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return NextResponse.json(
        {
          error: 'Cannot cancel job',
          message: `Job is already in terminal state: ${job.status}`,
        },
        { status: 400 }
      );
    }

    // 4. Cancel Job
    const updatedJob = await prisma.hydrationJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    // 5. Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'HYDRATEALL_CANCEL',
        details: {
          jobId,
          previousStatus: job.status,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    // 6. Log Cancellation
    await prisma.jobExecutionLog.create({
      data: {
        jobId,
        event: 'CANCELLED',
        message: `Job cancelled by admin: ${session.user.email || session.user.id}`,
        meta: {
          userId: session.user.id,
          previousStatus: job.status,
        },
      },
    });

    logger.info('Job cancelled', {
      jobId,
      userId: session.user.id,
      previousStatus: job.status,
    });

    // 7. Return Response
    return NextResponse.json(
      {
        jobId: updatedJob.id,
        previousStatus: job.status,
        newStatus: 'cancelled',
        message: 'Job cancelled successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Failed to cancel job', {
      error: error.message,
      stack: error.stack,
      jobId: params.jobId,
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
