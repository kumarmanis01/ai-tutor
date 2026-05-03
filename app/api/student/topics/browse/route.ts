/**
 * GET /api/student/topics/browse
 *
 * Returns subjects -> chapters -> topics for the authenticated student's
 * grade and board, enriched with mastery data for gamification display.
 *
 * Query params:
 *   subjectId  (optional) - filter to one subject
 *   limit      (optional) - max topics per chapter, default 20
 *
 * EDIT LOG:
 * - 2026-05-03 | claude | created for gamify-topics-parent-alerts task
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// XP reward tiers based on estimated topic complexity (order in chapter)
function topicXpReward(topicOrder: number): number {
  if (topicOrder <= 3) return 50;
  if (topicOrder <= 6) return 75;
  return 100;
}

function masteryLabel(mastery: number): string {
  if (mastery >= 0.8) return 'Mastered';
  if (mastery >= 0.55) return 'Strong';
  if (mastery >= 0.3) return 'Getting There';
  return 'Not Started';
}

function masteryColor(mastery: number): string {
  if (mastery >= 0.8) return 'green';
  if (mastery >= 0.55) return 'blue';
  if (mastery >= 0.3) return 'amber';
  return 'gray';
}

export async function GET(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'BrowseTopicsAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const url = new URL(req.url);
    const filterSubjectId = url.searchParams.get('subjectId') ?? undefined;
    const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

    // Get student's grade and board for subject scoping
    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, board: true },
    });

    if (!student?.grade) {
      const res = NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });
      logger.logAPI(req, res, { className: 'BrowseTopicsAPI', methodName: 'GET' }, start);
      return res;
    }

    // Resolve ClassLevel for the student's grade
    const classLevel = await prisma.classLevel.findFirst({
      where: { grade: String(student.grade) },
      select: { id: true },
    });

    if (!classLevel) {
      const res = NextResponse.json({ subjects: [] });
      logger.logAPI(req, res, { className: 'BrowseTopicsAPI', methodName: 'GET' }, start);
      return res;
    }

    // Fetch subjects with chapters and topics
    const subjects = await prisma.subjectDef.findMany({
      where: {
        classId: classLevel.id,
        isAvailable: true,
        lifecycle: 'active',
        ...(filterSubjectId ? { id: filterSubjectId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        chapters: {
          where: { lifecycle: 'active', status: 'approved' },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            order: true,
            topics: {
              where: { lifecycle: 'active', status: 'approved' },
              orderBy: { order: 'asc' },
              take: limit,
              select: {
                id: true,
                name: true,
                order: true,
              },
            },
          },
        },
      },
    });

    // Gather all topic IDs for mastery lookup
    const allTopicIds = subjects.flatMap((s) =>
      s.chapters.flatMap((c) => c.topics.map((t) => t.id))
    );

    // Batch-load mastery for all topics
    const progressRows = await prisma.studentTopicProgress.findMany({
      where: { studentId: userId, topicId: { in: allTopicIds } },
      select: { topicId: true, mastery: true, practiceCount: true },
    });

    const masteryMap = new Map(progressRows.map((p) => [p.topicId, p]));

    // Build response
    const enrichedSubjects = subjects
      .filter((s) => s.chapters.some((c) => c.topics.length > 0))
      .map((subject) => ({
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        chapters: subject.chapters
          .filter((c) => c.topics.length > 0)
          .map((chapter) => ({
            id: chapter.id,
            name: chapter.name,
            topics: chapter.topics.map((topic) => {
              const prog = masteryMap.get(topic.id);
              const mastery = prog?.mastery ?? 0;
              const practiceCount = prog?.practiceCount ?? 0;
              return {
                id: topic.id,
                name: topic.name,
                mastery,
                masteryLabel: masteryLabel(mastery),
                masteryColor: masteryColor(mastery),
                practiceCount,
                xpReward: topicXpReward(topic.order),
                isStarted: practiceCount > 0 || mastery > 0,
                isMastered: mastery >= 0.8,
              };
            }),
          })),
      }));

    const res = NextResponse.json({ subjects: enrichedSubjects });
    logger.logAPI(req, res, { className: 'BrowseTopicsAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('[browse-topics] error', { userId, error: String((err as Error)?.message ?? err) });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'BrowseTopicsAPI', methodName: 'GET' }, start);
    return res;
  }
}
