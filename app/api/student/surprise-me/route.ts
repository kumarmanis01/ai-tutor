import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent';
import { rankTopics } from '@/lib/recommendations/topicRanker';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/student/surprise-me
 *
 * Returns a single suggestion selected by the "Surprise me" action.
 * Primary intent: pick the student's highest-priority weak topic (mastery < 0.4,
 * practiceCount > 5). If none found, fallback to the TopicRanker top result.
 */
export async function GET(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    // 1. Try to pick the most urgent weak topic (mastery < 0.4 & practiceCount > 5)
    const weak = await prisma.studentTopicProgress.findFirst({
      where: { studentId: userId, mastery: { lt: 0.4 }, practiceCount: { gt: 5 } },
      orderBy: [{ mastery: 'asc' }, { practiceCount: 'desc' }],
      include: {
        topic: {
          include: { chapter: { include: { subject: true } } },
        },
      },
    });

    if (weak) {
      const topic = weak.topic;
      const action = {
        topicId: topic.id,
        topicName: topic.name,
        subject: topic.chapter?.subject?.name ?? null,
        chapter: topic.chapter?.name ?? null,
        ruleId: 'surprise_me',
        reasonLabel: `Try strengthening ${topic.name}`,
        actionType: 'practice',
      };
      const res = NextResponse.json({ action, source: 'surprise_me' }, { status: 200 });
      logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start);
      return res;
    }

    // 2. Fallback: use TopicRanker (similar to P5 in getNextAction)
    const ordered = await getOrderedTopicsForStudent(userId);
    const scored = await rankTopics(userId, { preloadedOrderedTopics: ordered });
    const best = scored?.[0];
    if (best) {
      const action = {
        topicId: best.topicId,
        topicName: best.topicName,
        subject: best.subjectName,
        chapter: best.chapterName,
        ruleId: 'surprise_me_fallback',
        reasonLabel: `Try ${best.topicName}`,
        actionType: 'notes',
      };
      const res = NextResponse.json({ action, source: 'surprise_me' }, { status: 200 });
      logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start);
      return res;
    }

    const res = NextResponse.json({ action: null, source: 'surprise_me' }, { status: 204 });
    logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('[surprise-me] error', { userId, error: String((err as any)?.message ?? err) });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start);
    return res;
  }
}
