import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  completeSession,
  getPhaseContent,
  isSessionEngineEnabled,
  SessionError,
} from '@/lib/session/sessionEngine';
import { updateStudentTopicProgress } from '@/lib/tests';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/session/complete
 * Body: { sessionId: string }
 *
 * Marks the session as COMPLETE and updates topic progress.
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'SessionCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.sessionId) {
    res = NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const view = await completeSession(user.id, body.sessionId);
    const phase = getPhaseContent(view.state);

    // Touch lastStudiedAt so the topic ranker picks up the recency signal
    try {
      await updateStudentTopicProgress(user.id, view.topicId, 0, 0);
    } catch (err) {
      logger.error('SessionCompleteAPI.progressUpdate', { userId: user.id, error: err });
    }

    res = NextResponse.json({ session: view, phase });
  } catch (err) {
    if (err instanceof SessionError) {
      res = NextResponse.json({ error: err.message }, { status: err.status });
    } else {
      logger.error('SessionCompleteAPI.error', { userId: user.id, error: err });
      res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  logger.logAPI(req, res, { className: 'SessionCompleteAPI', methodName: 'POST' }, start);
  return res;
}
