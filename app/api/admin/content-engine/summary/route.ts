import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

export async function GET() {
  await requireAdminOrModerator();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ExecutionJob counts
  const [execQueued, execRunning, execFailed, execCompletedToday] = await Promise.all([
    prisma.executionJob.count({ where: { status: 'pending' } }),
    prisma.executionJob.count({ where: { status: 'running' } }),
    prisma.executionJob.count({ where: { status: 'failed' } }),
    prisma.executionJob.count({ where: { status: 'completed', updatedAt: { gte: startOfDay } } }),
  ]);

  // HydrationJob counts (root jobs only)
  const [hydrationPending, hydrationRunning, hydrationCompleted, hydrationFailed] = await Promise.all([
    prisma.hydrationJob.count({ where: { rootJobId: null, status: 'pending' } }),
    prisma.hydrationJob.count({ where: { rootJobId: null, status: 'running' } }),
    prisma.hydrationJob.count({ where: { rootJobId: null, status: 'completed' } }),
    prisma.hydrationJob.count({ where: { rootJobId: null, status: 'failed' } }),
  ]);

  // Content counts
  const [chapters, topics, notes, questions] = await Promise.all([
    prisma.chapterDef.count({ where: { lifecycle: 'active' } }),
    prisma.topicDef.count({ where: { lifecycle: 'active' } }),
    prisma.topicNote.count({ where: { lifecycle: 'active' } }),
    prisma.generatedQuestion.count(),
  ]);

  return NextResponse.json({
    queued: execQueued + hydrationPending,
    running: execRunning + hydrationRunning,
    failed: execFailed + hydrationFailed,
    completedToday: execCompletedToday,
    hydration: {
      pending: hydrationPending,
      running: hydrationRunning,
      completed: hydrationCompleted,
      failed: hydrationFailed,
    },
    content: {
      chapters,
      topics,
      notes,
      questions,
    },
  });
}
