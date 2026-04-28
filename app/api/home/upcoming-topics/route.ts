import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/home/upcoming-topics
 *
 * Returns the next 4 curriculum-ordered topics that the student has not
 * yet started (no StudentTopicProgress record). Uses the same ordered
 * topic list as the recommendation engine.
 *
 * Response:
 *   { topics: { topicId, topicName, subject, chapter }[] }
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'UpcomingTopicsAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const orderedTopics = await getOrderedTopicsForStudent(user.id);

    // Fetch topics the student has already started
    const startedTopicIds = new Set(
      (
        await prisma.studentTopicProgress.findMany({
          where: { studentId: user.id },
          select: { topicId: true },
        })
      ).map((p) => p.topicId)
    );

    const upcoming = orderedTopics
      .filter((t) => !startedTopicIds.has(t.id))
      .slice(0, 4)
      .map((t) => ({
        topicId: t.id,
        topicName: t.name,
        subject: t.subject,
        chapter: t.chapter,
      }));

    res = NextResponse.json({ topics: upcoming });
  } catch (err) {
    logger.error('UpcomingTopicsAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  logger.logAPI(req, res, { className: 'UpcomingTopicsAPI', methodName: 'GET' }, start);
  return res;
}
