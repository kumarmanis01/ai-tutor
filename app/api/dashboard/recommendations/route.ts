/**
 * FILE OBJECTIVE:
 * - API endpoint for personalized content recommendations using multi-signal scoring.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/dashboard/recommendations/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | integrated optimized recommendation engine
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRecommendationsForUser } from '@/lib/recommendations/engine';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // Get personalized recommendations from engine
    const recommendations = await getRecommendationsForUser(userId, 15);
    
    // Transform to API response format
    const items = recommendations.map((r) => ({
      id: r.id,
      contentId: r.contentId,
      type: r.type,
      subject: r.subject,
      title: r.title,
      chapter: r.chapter,
      difficulty: r.difficulty,
      score: r.score,
      reasoning: r.reasoning.join(' • '),
      priority: r.score, // For backward compatibility
      meta: r.meta
    }));

    // If no recommendations from engine, fall back to basic profile match
    if (items.length === 0) {
      const fallback = await getFallbackRecommendations(userId);
      return NextResponse.json({ items: fallback });
    }

    logger.info('recommendations.get', { userId, count: items.length });
    return NextResponse.json({ items });
  } catch (error) {
    logger.error('recommendations.get.error', {
      userId,
      error,
    });
    
    // Graceful fallback on error
    const fallback = await getFallbackRecommendations(userId);
    return NextResponse.json({ items: fallback });
  }
}

/**
 * Fallback recommendations when engine fails or returns empty.
 * Priority order:
 *   1. Topic with incomplete session
 *   2. Weak mastery topic (low-accuracy chapter → first topic)
 *   3. Next topic in chapter sequence
 *   4. First topic in syllabus
 * Every item includes meta.topicId / meta.chapterId / meta.subjectId.
 */
async function getFallbackRecommendations(userId: string) {
  // Fetch user profile and most recent incomplete session in parallel
  const [user, incompleteSession] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { subjects: true, board: true, grade: true },
    }),
    prisma.learningSession.findFirst({
      where: { studentId: userId, isCompleted: false },
      orderBy: { lastAccessed: 'desc' },
      select: { activityRef: true, activityType: true, meta: true },
    }),
  ]);

  const subjects = (user?.subjects || []) as string[];
  const hasSubjects = subjects && subjects.length > 0;
  const items: any[] = [];

  // 1. Incomplete session → resume topic
  if (incompleteSession) {
    const meta = (incompleteSession.meta && typeof incompleteSession.meta === 'object')
      ? incompleteSession.meta as Record<string, unknown>
      : {};
    const topicId = (meta.topicId as string) || incompleteSession.activityRef || null;
    if (topicId) {
      const topic = await prisma.topicDef.findUnique({
        where: { id: topicId },
        select: {
          name: true,
          chapter: {
            select: {
              id: true,
              name: true,
              subject: { select: { id: true, name: true } },
            },
          },
        },
      }).catch(() => null);
      items.push({
        id: `resume:${topicId}`,
        contentId: `topic:${topicId}`,
        type: incompleteSession.activityType === 'practice' ? 'practice' : 'notes',
        subject: topic?.chapter?.subject?.name || (meta.subject as string) || 'General',
        title: topic ? `Continue: ${topic.name}` : 'Continue where you left off',
        reasoning: 'Resume your incomplete session',
        priority: 100,
        meta: {
          topicId,
          chapterId: topic?.chapter?.id,
          chapterName: topic?.chapter?.name,
          subjectId: topic?.chapter?.subject?.id,
          subjectName: topic?.chapter?.subject?.name,
        },
      });
    }
  }

  // 2. Weak mastery topic via low-score test results
  const weakResults = await prisma.testResult.findMany({
    where: { studentId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { score: true, totalMarks: true, testId: true },
  });
  const weakTestIds = weakResults
    .filter((r: any ) => r.totalMarks && r.totalMarks > 0 && (r.score ?? 0) / r.totalMarks < 0.6)
    .map((r: any ) => r.testId)
    .filter(Boolean);

  if (weakTestIds.length > 0) {
    const weakTest = await prisma.generatedTest.findFirst({
      where: { id: { in: weakTestIds as string[] } },
      select: {
        topic: {
          select: {
            id: true,
            name: true,
            chapter: {
              select: {
                id: true,
                name: true,
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }).catch(() => null);
    if (weakTest?.topic) {
      items.push({
        id: `weak:${weakTest.topic.id}`,
        contentId: `practice:${weakTest.topic.id}`,
        type: 'practice',
        subject: weakTest.topic.chapter?.subject?.name || 'General',
        title: `Strengthen: ${weakTest.topic.name}`,
        reasoning: 'Review recommended based on test performance',
        priority: 90,
        meta: {
          topicId: weakTest.topic.id,
          topicName: weakTest.topic.name,
          chapterId: weakTest.topic.chapter?.id,
          chapterName: weakTest.topic.chapter?.name,
          subjectId: weakTest.topic.chapter?.subject?.id,
          subjectName: weakTest.topic.chapter?.subject?.name,
        },
      });
    }
  }

  // 3. Next topic in chapter -- first uncompleted topic per chapter
  const chapters = await prisma.chapterDef.findMany({
    where: {
      lifecycle: 'active',
      ...(hasSubjects ? { subject: { name: { in: subjects } } } : {}),
    },
    take: 10,
    include: {
      subject: { select: { id: true, name: true } },
      topics: { select: { id: true, name: true }, orderBy: { order: 'asc' }, take: 1 },
    },
    orderBy: { order: 'asc' },
  });

  for (const c of chapters) {
    if (items.length >= 10) break;
    const topic = c.topics?.[0];
    items.push({
      id: topic?.id || c.id,
      contentId: topic ? `lesson:${topic.id}` : `lesson:${c.id}`,
      type: 'lesson',
      subject: c.subject?.name || 'General',
      title: topic ? `Learn: ${topic.name}` : c.name,
      chapter: c.slug,
      reasoning: `Next topic in ${c.name} -- ${c.subject?.name || 'your curriculum'}`,
      priority: 60,
      meta: {
        topicId: topic?.id || null,
        topicName: topic?.name || null,
        chapterId: c.id,
        chapterName: c.name,
        subjectId: c.subject?.id || null,
        subjectName: c.subject?.name || null,
      },
    });
  }

  // 4. First topic in syllabus (absolute fallback for brand-new users)
  if (items.length === 0) {
    const firstChapter = await prisma.chapterDef.findFirst({
      where: {
        lifecycle: 'active',
        ...(hasSubjects ? { subject: { name: { in: subjects } } } : {}),
      },
      orderBy: { order: 'asc' },
      include: {
        subject: { select: { id: true, name: true } },
        topics: { select: { id: true, name: true }, orderBy: { order: 'asc' }, take: 1 },
      },
    });

    const firstTopic = firstChapter?.topics?.[0];
    items.push({
      id: firstTopic?.id || 'explore-1',
      contentId: firstTopic ? `lesson:${firstTopic.id}` : 'explore-1',
      type: 'lesson' as const,
      subject: firstChapter?.subject?.name || subjects[0] || 'Mathematics',
      title: firstTopic ? `Start: ${firstTopic.name}` : `Explore ${subjects[0] || 'Mathematics'}`,
      reasoning: 'Start learning with recommended content',
      priority: 40,
      meta: {
        topicId: firstTopic?.id || null,
        topicName: firstTopic?.name || null,
        chapterId: firstChapter?.id || null,
        chapterName: firstChapter?.name || null,
        subjectId: firstChapter?.subject?.id || null,
        subjectName: firstChapter?.subject?.name || null,
      },
    });
  }

  return items;
}
