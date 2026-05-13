/**
 * FILE OBJECTIVE:
 * - Force-complete a structured learning session and return the final phase payload.
 * - Emits canonical session completion analytics alongside the existing session event record.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/analytics.routes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | emit canonical student session completion analytics on force-complete
 */

import '@/lib/events/sessionEventListeners'; // COUPLING-01: register SESSION_COMPLETED → TopicRanker invalidation
import { NextResponse } from 'next/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
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
      user.id,
    );

    recordSessionEvent({
      sessionId: view.sessionId,
      eventType: 'SESSION_COMPLETED',
      metadata: { studentId: user.id, topicId: view.topicId },
    });

    await emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.STUDENT.SESSION_COMPLETE,
        userId: user.id,
        courseId: view.topicId,
        metadata: {
          sessionId: view.sessionId,
          topicId: view.topicId,
          currentPhase: view.currentPhase,
        },
      },
      'session.complete',
    );

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
