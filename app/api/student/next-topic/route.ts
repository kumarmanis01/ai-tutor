import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/student/next-topic
 *
 * Returns the single best next topic for the authenticated student.
 * Gated by ENABLE_TUTOR_CARD feature flag.
 * Delegates to the Home Tutor Engine (getNextAction).
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
    logger.logAPI(req, res, { className: 'StudentNextTopicAPI', methodName: 'GET' }, start);
    return res;
  }

  const flag = process.env.ENABLE_TUTOR_CARD;
  if (flag !== '1' && flag !== 'true') {
    res = NextResponse.json({ topic: null });
    logger.logAPI(req, res, { className: 'StudentNextTopicAPI', methodName: 'GET' }, start);
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
    logger.error('StudentNextTopicAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ topic: null });
  }

  logger.logAPI(req, res, { className: 'StudentNextTopicAPI', methodName: 'GET' }, start);
  return res;
}
