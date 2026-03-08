import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/home/review-queue
 *
 * Returns up to 5 topics due for spaced revision (P3 logic).
 * Mastery band → revision interval:
 *   0.40–0.60 → 3 days
 *   0.60–0.75 → 7 days
 *   0.75–0.90 → 14 days
 *   0.90–1.00 → 30 days
 *
 * Response:
 *   { topics: { topicId, topicName, subject, chapter, mastery, daysSinceStudied }[] }
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'ReviewQueueAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const now = new Date();

    // Fetch all topic progress in the "getting there" to "proficient" mastery bands
    const progressRecords = await prisma.studentTopicProgress.findMany({
      where: {
        studentId: user.id,
        mastery: { gte: 0.4, lt: 0.9 }, // bands that benefit from spaced revision
      },
      orderBy: { lastStudiedAt: 'asc' }, // oldest first
      take: 20,
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

    function intervalDaysForMastery(mastery: number): number {
      if (mastery < 0.6) return 3;
      if (mastery < 0.75) return 7;
      if (mastery < 0.9) return 14;
      return 30;
    }

    const dueTopics = progressRecords
      .filter((p) => {
        const intervalDays = intervalDaysForMastery(p.mastery);
        const daysSince =
          (now.getTime() - new Date(p.lastStudiedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince >= intervalDays;
      })
      .slice(0, 5)
      .map((p) => ({
        topicId: p.topicId,
        topicName: p.topic.name,
        subject: p.topic.chapter.subject.name,
        chapter: p.topic.chapter.name,
        mastery: p.mastery,
        daysSinceStudied: Math.floor(
          (now.getTime() - new Date(p.lastStudiedAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
      }));

    res = NextResponse.json({ topics: dueTopics });
  } catch (err) {
    logger.error('ReviewQueueAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  logger.logAPI(req, res, { className: 'ReviewQueueAPI', methodName: 'GET' }, start);
  return res;
}
