import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { JobStatus } from '@/lib/ai-engine/types';

const SYSTEM_SETTING_KEYS = ['AI_PAUSED', 'HYDRATION_PAUSED', 'NEXT_PUBLIC_HINDI_ENABLED'] as const;

export async function GET(req: NextRequest) {
  const adminKey = process.env.ADMIN_DEBUG_KEY;
  if (!adminKey || req.headers.get('x-admin-key') !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [
    systemSettings,
    hydrationCounts,
    executionCounts,
    recentFailedHydration,
    recentFailedExecution,
  ] = await Promise.all([
    prisma.systemSetting.findMany({
      where: { key: { in: [...SYSTEM_SETTING_KEYS] } },
      select: { key: true, value: true },
    }),
    prisma.hydrationJob.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.executionJob.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.hydrationJob.findMany({
      where: { status: JobStatus.Failed },
      select: { id: true, subjectId: true, lastError: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.executionJob.findMany({
      where: { status: JobStatus.Failed },
      select: { id: true, lastError: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    env: {
      OPENAI_KEY_SET: !!process.env.OPENAI_API_KEY,
      ALLOW_LLM_CALLS: process.env.ALLOW_LLM_CALLS,
      LLM_MODE: process.env.LLM_MODE,
      NODE_ENV: process.env.NODE_ENV,
    },
    systemSettings,
    hydrationJobCounts: Object.fromEntries(
      hydrationCounts.map(r => [r.status, r._count.status]),
    ),
    executionJobCounts: Object.fromEntries(
      executionCounts.map(r => [r.status, r._count.status]),
    ),
    recentFailedHydrationJobs: recentFailedHydration,
    recentFailedExecutionJobs: recentFailedExecution,
  });
}
