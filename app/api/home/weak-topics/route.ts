import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/home/weak-topics
 *
 * Returns up to 5 topics where mastery is below 0.45 and the student
 * has attempted practice (practiceCount >= 2), indicating a genuine gap
 * rather than a topic not yet studied.
 *
 * Response:
 *   { topics: { topicId, topicName, subject, chapter, mastery, accuracyPercent }[] }
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'WeakTopicsAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const weakRecords = await prisma.studentTopicProgress.findMany({
      where: {
        studentId: user.id,
        mastery: { lt: 0.45 },
        practiceCount: { gte: 2 },
      },
      orderBy: { mastery: 'asc' }, // weakest first
      take: 5,
      include: {
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
    });

    const topics = weakRecords.map((p: any) => ({
      topicId: p.topicId,
      topicName: p.topic.name,
      subject: p.topic.chapter.subject.name,
      chapter: p.topic.chapter.name,
      mastery: p.mastery,
      accuracyPercent: Math.round(p.mastery * 100),
    }));

    res = NextResponse.json({ topics });
  } catch (err) {
    logger.error('WeakTopicsAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  logger.logAPI(req, res, { className: 'WeakTopicsAPI', methodName: 'GET' }, start);
  return res;
}
