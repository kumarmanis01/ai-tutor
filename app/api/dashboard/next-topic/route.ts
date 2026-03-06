import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextTopicRecommendation } from '@/lib/recommendations/topicRanker';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/next-topic
 *
 * Returns the single best next topic for the authenticated student.
 * Gated by ENABLE_TOPIC_RECOMMENDATION feature flag.
 *
 * Response: { topic: { topicId, subject, chapter, reason } | null }
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'NextTopicAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const topic = await getNextTopicRecommendation(user.id);
    res = NextResponse.json({ topic });
  } catch (err) {
    logger.error('NextTopicAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ topic: null });
  }

  logger.logAPI(req, res, { className: 'NextTopicAPI', methodName: 'GET' }, start);
  return res;
}
