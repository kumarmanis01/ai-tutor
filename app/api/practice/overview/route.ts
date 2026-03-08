import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { getWeakTopics } from '@/lib/learning/getWeakTopics';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/practice/overview
 *
 * Returns topic-first data for the Practice page:
 *   - recommendedTopic: from the Home Tutor Engine (single best next topic)
 *   - weakTopics: topics with mastery < 0.4 and practiceCount > 5
 *
 * Used by the simplified Practice page (Recommended Practice + Weak Topics sections).
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'PracticeOverviewAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const [engineResult, weakTopicRows] = await Promise.all([
      getNextAction(user.id),
      getWeakTopics(user.id),
    ]);

    const action = engineResult && 'action' in engineResult ? engineResult.action : engineResult;

    const recommendedTopic =
      action && action.topicId
        ? {
            topicId: action.topicId,
            topicName: action.topicName,
            subject: action.subject,
            chapter: action.chapter,
            reason: action.reasonLabel,
          }
        : null;

    // Resolve names for weak topics
    const weakTopicIds = weakTopicRows.map((w) => w.topicId);
    const weakTopicDefs =
      weakTopicIds.length > 0
        ? await prisma.topicDef.findMany({
            where: { id: { in: weakTopicIds } },
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  name: true,
                  subject: { select: { name: true } },
                },
              },
            },
          })
        : [];

    const topicDefMap = new Map(weakTopicDefs.map((t) => [t.id, t]));

    const weakTopics = weakTopicRows.map((w) => {
      const def = topicDefMap.get(w.topicId);
      return {
        topicId: w.topicId,
        topicName: def?.name ?? 'Unknown',
        chapter: def?.chapter.name ?? '',
        subject: def?.chapter.subject.name ?? '',
        mastery: w.mastery,
        practiceCount: w.practiceCount,
      };
    });

    res = NextResponse.json({ recommendedTopic, weakTopics });
  } catch (err) {
    logger.error('PracticeOverviewAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ recommendedTopic: null, weakTopics: [] });
  }

  logger.logAPI(req, res, { className: 'PracticeOverviewAPI', methodName: 'GET' }, start);
  return res;
}
