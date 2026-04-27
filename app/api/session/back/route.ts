import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  navigateSessionBack,
  getPhaseContent,
  isSessionEngineEnabled,
  SessionError,
  type SessionPhase,
} from '@/lib/session/sessionEngine';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/session/back
 * Body: { sessionId: string, targetPhase: SessionPhase }
 *
 * Navigates the session back to a previously completed phase so the student
 * can review content. The target phase must be before the current phase in
 * PHASE_ORDER -- forward navigation is blocked (use /api/session/next).
 *
 * Response: { session: SessionView, phase: PhaseContent, content: PhaseContentData }
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionBackAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'SessionBackAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.sessionId || typeof body.sessionId !== 'string') {
    res = NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionBackAPI', methodName: 'POST' }, start);
    return res;
  }
  if (!body?.targetPhase || typeof body.targetPhase !== 'string') {
    res = NextResponse.json({ error: 'targetPhase is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionBackAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const view = await navigateSessionBack(user.id, body.sessionId, body.targetPhase as SessionPhase);
    const phase = getPhaseContent(view.currentPhase);
    const content = await resolvePhaseContent(
      view.currentPhase,
      view.topicId,
      view.sessionId,
      user.id,
    );

    res = NextResponse.json({ session: view, phase, content });
  } catch (err) {
    if (err instanceof SessionError) {
      res = NextResponse.json({ error: err.message }, { status: err.status });
    } else {
      logger.error('SessionBackAPI.error', { userId: user.id, error: err });
      res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  logger.logAPI(req, res, { className: 'SessionBackAPI', methodName: 'POST' }, start);
  return res;
}
