import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/next-topic
 *
 * Returns the single best next topic for the authenticated student.
 * Delegates to the Home Tutor Engine (getNextAction) -- no feature flag.
 *
 * Response: { topic: { topicId, topicName, subject, chapter, reason } | null }
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
    const result = await getNextAction(user.id);
    const action = result && 'action' in result ? result.action : result;

    const topic =
      action && action.topicId
        ? {
            topicId: action.topicId,
            topicName: action.topicName,
            subject: action.subject,
            chapter: action.chapter,
            reason: action.reasonLabel,
          }
        : null;

    res = NextResponse.json({ topic });
  } catch (err) {
    logger.error('NextTopicAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ topic: null });
  }

  logger.logAPI(req, res, { className: 'NextTopicAPI', methodName: 'GET' }, start);
  return res;
}
