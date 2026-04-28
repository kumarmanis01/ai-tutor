/**
 * FILE OBJECTIVE:
 * - GET /api/v1/students/[studentId]/learning-map
 * - Returns chapter-node data for the student learning map with completed/current/locked/premium-locked states.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/learning-map/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.1 learning map endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type ChapterState = 'completed' | 'current' | 'locked' | 'premium-locked';

interface Params {
  params: Promise<{ studentId: string }>;
}

function masteryToPercent(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export async function GET(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId } = await params;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'StudentLearningMapAPI', methodName: 'GET' }, start);
      return res;
    }

    if (userId !== studentId) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      logger.logAPI(req, res, { className: 'StudentLearningMapAPI', methodName: 'GET' }, start);
      return res;
    }

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        board: true,
        grade: true,
        totalXp: true,
        currentStreak: true,
        subscriptionStatus: true,
      },
    });

    if (!student?.board || !student?.grade) {
      const res = NextResponse.json({
        chapters: [],
        topBar: { xp: student?.totalXp ?? 0, streak: student?.currentStreak ?? 0 },
        currentChapter: null,
        lastSyncedAt: new Date().toISOString(),
      });
      logger.logAPI(req, res, { className: 'StudentLearningMapAPI', methodName: 'GET' }, start);
      return res;
    }

    const gradeNumber = Number.parseInt(String(student.grade), 10);
    if (Number.isNaN(gradeNumber)) {
      const res = NextResponse.json({ error: 'Invalid student grade' }, { status: 400 });
      logger.logAPI(req, res, { className: 'StudentLearningMapAPI', methodName: 'GET' }, start);
      return res;
    }

    const subjects = await prisma.subjectDef.findMany({
      where: {
        lifecycle: 'active',
        class: {
          grade: gradeNumber,
          board: { slug: { equals: student.board, mode: 'insensitive' } },
        },
      },
      select: {
        id: true,
        name: true,
        chapters: {
          where: { lifecycle: 'active' },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            order: true,
            topics: {
              where: { lifecycle: 'active' },
              orderBy: { order: 'asc' },
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const topicIds = subjects.flatMap((s) => s.chapters.flatMap((ch) => ch.topics.map((t) => t.id)));

    const topicProgress = topicIds.length
      ? await prisma.studentTopicProgress.findMany({
          where: { studentId: userId, topicId: { in: topicIds } },
          select: { topicId: true, mastery: true, practiceCount: true },
        })
      : [];

    const progressMap = new Map(topicProgress.map((row) => [row.topicId, row]));
    const isPremium = student.subscriptionStatus !== 'free';

    let hasCurrent = false;
    let currentChapterId: string | null = null;

    const chapterNodes: Array<{
      chapterId: string;
      chapterName: string;
      subjectId: string;
      subjectName: string;
      topicsCount: number;
      completedTopics: number;
      completionPercent: number;
      scorePercent: number;
      state: ChapterState;
      ctaLabel: 'Start' | 'Continue' | 'Review' | null;
      tooltip: string | null;
      previewTopicId: string | null;
    }> = [];

    let chapterSequence = 0;

    for (const subject of subjects) {
      for (const chapter of subject.chapters) {
        chapterSequence++;

        const topicRows = chapter.topics.map((topic) => progressMap.get(topic.id));
        const topicsCount = chapter.topics.length;

        const masteredCount = topicRows.filter(
          (row) => row && masteryToPercent(row.mastery) >= 70
        ).length;
        const completionPercent = topicsCount > 0 ? Math.round((masteredCount / topicsCount) * 100) : 0;

        const avgMastery =
          topicRows.length > 0
            ? topicRows.reduce((sum, row) => sum + (row?.mastery ?? 0), 0) / topicRows.length
            : 0;

        const fullyCompleted = topicsCount > 0 && masteredCount >= topicsCount;
        const premiumLocked = !isPremium && chapterSequence > 2 && !fullyCompleted;

        let state: ChapterState;
        if (premiumLocked) {
          state = 'premium-locked';
        } else if (fullyCompleted) {
          state = 'completed';
        } else if (!hasCurrent) {
          state = 'current';
          hasCurrent = true;
          currentChapterId = chapter.id;
        } else {
          state = 'locked';
        }

        let ctaLabel: 'Start' | 'Continue' | 'Review' | null = null;
        if (state === 'current') {
          ctaLabel = completionPercent > 0 ? 'Continue' : 'Start';
        } else if (state === 'completed') {
          ctaLabel = 'Review';
        }

        const tooltip =
          state === 'locked'
            ? 'Complete the previous chapter first!'
            : state === 'premium-locked'
              ? 'Unlock Premium to access this chapter.'
              : null;

        chapterNodes.push({
          chapterId: chapter.id,
          chapterName: chapter.name,
          subjectId: subject.id,
          subjectName: subject.name,
          topicsCount,
          completedTopics: masteredCount,
          completionPercent,
          scorePercent: masteryToPercent(avgMastery),
          state,
          ctaLabel,
          tooltip,
          previewTopicId: chapter.topics[0]?.id ?? null,
        });
      }
    }

    const currentChapter = chapterNodes.find((node) => node.chapterId === currentChapterId) ?? null;

    const res = NextResponse.json(
      {
        topBar: {
          xp: student.totalXp,
          streak: student.currentStreak,
        },
        chapters: chapterNodes,
        currentChapter,
        lastSyncedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      }
    );

    logger.logAPI(req, res, { className: 'StudentLearningMapAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('StudentLearningMapAPI.error', {
      event: 'student_learning_map_failed',
      context: { error: err instanceof Error ? err.message : String(err), studentId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'StudentLearningMapAPI', methodName: 'GET' }, start);
    return res;
  }
}
