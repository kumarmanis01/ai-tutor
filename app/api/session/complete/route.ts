import '@/lib/events/sessionEventListeners'; // COUPLING-01: register SESSION_COMPLETED → TopicRanker invalidation
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  completeSession,
  getPhaseContent,
  isSessionEngineEnabled,
  SessionError,
} from '@/lib/session/sessionEngine';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { logger } from '@/lib/logger';
import { recordSessionEvent } from '@/lib/session/sessionEvents';
import { notifyParentOnActivity } from '@/lib/notifications/parentActivityAlert';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/session/complete
 * Body: { sessionId: string }
 *
 * Force-completes the session regardless of current phase (e.g. "Finish early").
 * Progress persistence (StudentTopicProgress touch + TopicRanker cache
 * invalidation) is handled inside SessionEngine.completeSession() so this
 * route stays thin.
 *
 * Response:
 *   { session: SessionView, phase: PhaseContent, content: PhaseContentData }
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

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
  if (!body?.sessionId || typeof body.sessionId !== 'string') {
    res = NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    // Engine handles state transition + progress persistence internally.
    const view = await completeSession(user.id, body.sessionId);
    const phase = getPhaseContent(view.currentPhase);
    const content = await resolvePhaseContent(
      view.currentPhase,
      view.topicId,
      view.sessionId,
      user.id
    );

    recordSessionEvent({
      sessionId: view.sessionId,
      eventType: 'SESSION_COMPLETED',
      metadata: { studentId: user.id, topicId: view.topicId },
    });

    // Fire-and-forget: notify parent that student completed a session
    prisma.topicDef
      .findUnique({ where: { id: view.topicId }, select: { name: true, chapter: { select: { subject: { select: { name: true } } } } } })
      .then((topic) => {
        notifyParentOnActivity({
          studentId: user.id,
          activityType: 'session_completed',
          topicName: topic?.name ?? undefined,
          subjectName: topic?.chapter?.subject?.name ?? undefined,
        });
      })
      .catch(() => undefined);

    res = NextResponse.json({ session: view, phase, content });
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
