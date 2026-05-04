/**
 * FILE OBJECTIVE:
 * - A1.1: Content Moderation Dashboard -- unified page for AI Content and Syllabus Content.
 *   Tab 1 (AI Content): paginated Content records with flag/approve/reject.
 *   Tab 2 (Syllabus): draft ChapterDef/TopicDef/TopicNote/GeneratedTest with approve/reject/flag.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/page.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-29T15:40:00Z | copilot | initial A1.1 ModerationPage
 * - 2026-05-03T00:00:00Z | copilot | merge content-approval into moderation (tabs)
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { logger } from '@/lib/logger';
import { ModerationDashboardClient } from './ModerationDashboardClient';
import { SyllabusContentTab, type SyllabusItem } from './SyllabusContentTab';
import { ModerationTabWrapper } from './ModerationTabWrapper';

export const dynamic = 'force-dynamic';

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as Record<string, unknown>)?.message ?? String(err);
  if (typeof msg !== 'string') return false;
  const lowered = msg.toLowerCase();
  return lowered.includes('does not exist') && (lowered.includes('relation') || lowered.includes('table') || lowered.includes('public.'));
}

export async function fetchModerationInitialData(adminUserId: string) {
  const operation = 'ModerationPage.initialDataFetch';
  try {
    const { prisma } = await import('@/lib/db');
    const [rawItems, total] = await prisma.$transaction(async (tx) => {
      const items = await tx.content.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          topic: true,
          subject: true,
          grade: true,
          board: true,
          language: true,
          type: true,
          status: true,
          version: true,
          contentJson: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { flags: true } },
          generationJobs: {
            select: { id: true, subscriberIds: true, status: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      const count = await tx.content.count();
      return [items, count] as const;
    });

    const initialItems = rawItems.map((item) => {
      const job = item.generationJobs[0];
      const meta = (item.contentJson as Record<string, unknown> | null)?.metadata as Record<string, unknown> | undefined;
      const generator = (meta?.model ?? meta?.generator ?? null) as string | null;
      const confidence = (meta?.confidence ?? meta?.groundednessScore ?? null) as number | null;
      return {
        id: item.id,
        topic: item.topic,
        subject: item.subject,
        grade: item.grade,
        board: item.board,
        language: item.language,
        type: item.type,
        status: item.status,
        version: item.version,
        requestCount: job ? job.subscriberIds.length + 1 : 0,
        flagCount: item._count.flags,
        jobStatus: job?.status ?? null,
        generator,
        confidence,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });

    return { items: initialItems, total, migrated: true };
  } catch (err) {
    logger.error('[ERROR] ModerationPage SSR prefetch failed', {
      route: 'app/admin/moderation/page.tsx',
      operation,
      adminUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    if (isMissingTableError(err)) {
      return { items: [], total: 0, migrated: false };
    }
    throw err;
  }
}

async function fetchSyllabusItems(): Promise<SyllabusItem[]> {
  try {
    const { prisma } = await import('@/lib/db');
    const [chapters, topics, notes, tests] = await Promise.all([
      prisma.chapterDef.findMany({
        where: { status: 'draft', lifecycle: 'active' },
        include: { subject: { include: { class: { include: { board: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch(() => []),
      prisma.topicDef.findMany({
        where: { status: 'draft', lifecycle: 'active' },
        include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch(() => []),
      prisma.topicNote.findMany({
        where: { status: 'draft', lifecycle: 'active' },
        select: {
          id: true, title: true, language: true, createdAt: true,
          topic: {
            select: {
              name: true,
              chapter: {
                select: {
                  name: true,
                  subject: {
                    select: {
                      name: true,
                      class: { select: { grade: true, board: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch(() => []),
      prisma.generatedTest.findMany({
        where: { status: 'draft', lifecycle: 'active' },
        select: {
          id: true, title: true, difficulty: true, language: true, createdAt: true,
          topic: {
            select: {
              name: true,
              chapter: {
                select: {
                  name: true,
                  subject: {
                    select: {
                      name: true,
                      class: { select: { grade: true, board: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch(() => []),
    ]);

    const items: SyllabusItem[] = [
      ...chapters.map((c) => ({
        id: c.id,
        type: 'chapter' as const,
        subjectName: c.subject.name,
        boardName: c.subject.class.board.name,
        grade: c.subject.class.grade,
        chapterName: c.name,
        topicName: null,
        preview: c.name.substring(0, 80),
        language: null,
        difficulty: null,
        createdAt: c.createdAt.toISOString(),
      })),
      ...topics.map((t) => ({
        id: t.id,
        type: 'topic' as const,
        subjectName: t.chapter.subject.name,
        boardName: t.chapter.subject.class.board.name,
        grade: t.chapter.subject.class.grade,
        chapterName: t.chapter.name,
        topicName: t.name,
        preview: t.name.substring(0, 80),
        language: null,
        difficulty: null,
        createdAt: t.createdAt.toISOString(),
      })),
      ...notes.map((n) => ({
        id: n.id,
        type: 'note' as const,
        subjectName: n.topic.chapter.subject.name,
        boardName: n.topic.chapter.subject.class.board.name,
        grade: n.topic.chapter.subject.class.grade,
        chapterName: n.topic.chapter.name,
        topicName: n.topic.name,
        preview: n.title.substring(0, 80),
        language: n.language,
        difficulty: null,
        createdAt: n.createdAt.toISOString(),
      })),
      ...tests.map((t) => ({
        id: t.id,
        type: 'test' as const,
        subjectName: t.topic.chapter.subject.name,
        boardName: t.topic.chapter.subject.class.board.name,
        grade: t.topic.chapter.subject.class.grade,
        chapterName: t.topic.chapter.name,
        topicName: t.topic.name,
        preview: `${t.title} (${t.difficulty})`.substring(0, 80),
        language: t.language,
        difficulty: t.difficulty,
        createdAt: t.createdAt.toISOString(),
      })),
    ];

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  } catch (err) {
    logger.error('[ERROR] fetchSyllabusItems failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export default async function ModerationPage() {
  const guard = await requireActiveAdmin();
  if (!guard.ok) redirect('/admin/login');

  const [contentResult, syllabusItems] = await Promise.all([
    fetchModerationInitialData(guard.adminUserId),
    fetchSyllabusItems(),
  ]);

  const { items, total, migrated } = contentResult;

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review AI-generated content and syllabus items. Approve, reject, or flag for revision.
        </p>
      </div>

      {!migrated && (
        <div role="status" className="mb-4 p-3 rounded bg-yellow-50 text-yellow-800">
          Moderation database table not found. Please run migrations on the database.
        </div>
      )}

      <ModerationTabWrapper
        contentTab={
          <ModerationDashboardClient
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialItems={items as any}
            initialTotal={total}
          />
        }
        syllabusTab={<SyllabusContentTab items={syllabusItems} />}
        syllabusCount={syllabusItems.length}
      />
    </div>
  );
}
