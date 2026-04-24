
/**
 * FILE OBJECTIVE:
 * - Admin Content Readiness: HydrationJob status summary and list for admin dashboard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/contentReadiness.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-23T00:00:00Z | copilot | strict-mode: add local row types, annotate callbacks, file header
 * - 2026-04-24T00:00:00Z | copilot | strict-mode: add unit test and header update
 */

import { prisma } from '@/lib/prisma';

export type ReadinessStatus = 'not_started' | 'pending' | 'running' | 'completed' | 'failed';

export interface ContentReadinessSummary {
  pending: number;
  running: number;
  failed: number;
  completed: number;
}

export interface ContentReadinessItem {
  jobId: string;
  topicId: string | null;
  topicName: string;
  subjectName: string;
  chapterName: string;
  status: string;
  contentReady: boolean;
  lastError: string | null;
  updatedAt: Date;
}

export async function getReadinessSummary(): Promise<ContentReadinessSummary> {
  const [pending, running, failed, completed] = await Promise.all([
    prisma.hydrationJob.count({ where: { status: 'pending' } }),
    prisma.hydrationJob.count({ where: { status: 'running' } }),
    prisma.hydrationJob.count({ where: { status: 'failed' } }),
    prisma.hydrationJob.count({ where: { status: 'completed' } }),
  ]);
  return { pending, running, failed, completed };
}

export async function getReadinessList(opts: {
  board?: string;
  grade?: string;
  subjectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ContentReadinessItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const offset = opts.offset ?? 0;

  const where: Record<string, unknown> = {};
  if (opts.board) where.board = opts.board;
  if (opts.grade != null && opts.grade !== '') {
    const g = parseInt(opts.grade, 10);
    if (!Number.isNaN(g)) where.grade = g;
  }
  if (opts.subjectId) where.subjectId = opts.subjectId;
  if (opts.status) where.status = opts.status;

  const total = await prisma.hydrationJob.count({
    where: where as object,
  });


  // Local row type for hydrationJob
  type HydrationJobRow = {
    id: string;
    topicId: string | null;
    status: string;
    contentReady: boolean;
    lastError: string | null;
    updatedAt: Date;
    board?: string;
    grade?: number;
    subjectId?: string;
  };
  const jobs = await prisma.hydrationJob.findMany({
    where: where as object,
    orderBy: { updatedAt: 'desc' },
    skip: offset,
    take: limit,
    select: {
      id: true,
      topicId: true,
      status: true,
      contentReady: true,
      lastError: true,
      updatedAt: true,
      board: true,
      grade: true,
      subjectId: true,
    },
  }) as HydrationJobRow[];


  const topicIds = [...new Set((jobs.map((j: HydrationJobRow) => j.topicId).filter(Boolean) as string[]))];
  // Local row type for topicDef
  type TopicDefRow = {
    id: string;
    name: string;
    chapterId?: string;
    chapter?: {
      name?: string | null;
      subjectId?: string;
      subject?: { name?: string | null } | null;
    } | null;
  };
  const topics =
    topicIds.length > 0
      ? await prisma.topicDef.findMany({
          where: { id: { in: topicIds } },
          select: {
            id: true,
            name: true,
            chapterId: true,
            chapter: {
              select: {
                name: true,
                subjectId: true,
                subject: { select: { name: true } },
              },
            },
          },
        }) as TopicDefRow[]
      : [];

  interface TopicInfo {
    name: string;
    chapterName: string;
    subjectName: string;
  }

  const topicMap = new Map<string, TopicInfo>(
    (topics as TopicDefRow[]).map((t: TopicDefRow) => [
      t.id,
      {
        name: t.name,
        chapterName: t.chapter?.name ?? '--',
        subjectName: t.chapter?.subject?.name ?? '--',
      },
    ])
  );

  const items: ContentReadinessItem[] = (jobs as HydrationJobRow[]).map((j: HydrationJobRow) => {
    const t = j.topicId ? topicMap.get(j.topicId) : null;
    return {
      jobId: j.id,
      topicId: j.topicId,
      topicName: t?.name ?? j.topicId ?? '--',
      subjectName: t?.subjectName ?? '--',
      chapterName: t?.chapterName ?? '--',
      status: j.status,
      contentReady: j.contentReady,
      lastError: j.lastError,
      updatedAt: j.updatedAt,
    };
  });

  return { items, total };
}


export async function getGenerationPaused(): Promise<boolean> {
  // Local row type for adminConfig
  type AdminConfigRow = { value?: string | null };
  const row = await prisma.adminConfig.findUnique({
    where: { key: 'content_generation_paused' },
  }) as AdminConfigRow | null;
  return row?.value === '1' || row?.value === 'true';
}

export async function setGenerationPaused(paused: boolean): Promise<void> {
  await prisma.adminConfig.upsert({
    where: { key: 'content_generation_paused' },
    create: { key: 'content_generation_paused', value: paused ? '1' : '0', updatedAt: new Date() },
    update: { value: paused ? '1' : '0', updatedAt: new Date() },
  });
}
