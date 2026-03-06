import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  startSession,
  getPhaseContent,
  isSessionEngineEnabled,
  SessionError,
} from '@/lib/session/sessionEngine';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { logger } from '@/lib/logger';
import { recordSessionEvent } from '@/lib/session/sessionEvents';

export const dynamic = 'force-dynamic';

/**
 * POST /api/session/start
 * Body: { topicId: string }
 *
 * Creates (or resumes) a structured learning session for the topic.
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.topicId) {
    res = NextResponse.json({ error: 'topicId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const view = await startSession(user.id, body.topicId);
    const phase = getPhaseContent(view.state);
    const content = await resolvePhaseContent(view.state, view.topicId, view.sessionId, user.id);

    recordSessionEvent({
      sessionId: view.sessionId,
      eventType: 'SESSION_STARTED',
      metadata: { studentId: user.id, topicId: body.topicId, phase: view.state },
    });

    res = NextResponse.json({ session: view, phase, content });
  } catch (err) {
    if (err instanceof SessionError) {
      res = NextResponse.json({ error: err.message }, { status: err.status });
    } else {
      logger.error('SessionStartAPI.error', { userId: user.id, error: err });
      res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
  return res;
}
