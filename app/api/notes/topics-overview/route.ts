import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getWeakTopics } from '@/lib/learning/getWeakTopics';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notes/topics-overview
 *
 * Returns topic-first data for the Notes page:
 *   - activeSessionTopics: topics from in-progress structured sessions
 *   - weakTopics: topics with mastery < 0.4 and practiceCount > 5
 *
 * Topic names are resolved from TopicDef so the UI can display them.
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'NotesTopicsOverviewAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const [activeSessions, weakTopicRows] = await Promise.all([
      prisma.structuredSession.findMany({
        where: { studentId: user.id, state: { not: 'COMPLETE' } },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          topicId: true,
          state: true,
          topic: {
            select: {
              name: true,
              chapter: {
                select: {
                  name: true,
                  subject: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      getWeakTopics(user.id),
    ]);

    const activeSessionTopics = activeSessions.map((s: any) => ({
      sessionId: s.id,
      topicId: s.topicId,
      topicName: s.topic.name,
      chapter: s.topic.chapter.name,
      subject: s.topic.chapter.subject.name,
      phase: s.state,
    }));

    // Resolve names for weak topics
    const weakTopicIds = weakTopicRows.map((w) => w.topicId);
    const weakTopicDefs = weakTopicIds.length > 0
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

    const topicDefMap = new Map<string, any>(weakTopicDefs.map((t: any) => [t.id, t]));

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

    res = NextResponse.json({ activeSessionTopics, weakTopics });
  } catch (err) {
    logger.error('NotesTopicsOverviewAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ activeSessionTopics: [], weakTopics: [] });
  }

  logger.logAPI(req, res, { className: 'NotesTopicsOverviewAPI', methodName: 'GET' }, start);
  return res;
}
