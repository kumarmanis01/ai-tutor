/**
 * FILE OBJECTIVE:
 * - Advance a structured learning session through the canonical phase state machine.
 * - Emits lesson-view and lesson-complete analytics when the student crosses those phase boundaries.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/analytics.routes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | emit canonical lesson viewed/completed analytics from session phase transitions
 * - 2026-05-13T00:00:00Z | copilot | emit canonical session phases analytics on each structured phase transition
 */

import '@/lib/events/sessionEventListeners'; // COUPLING-01: register SESSION_COMPLETED → TopicRanker invalidation
import { NextResponse } from 'next/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  advanceSession,
  getPhaseContent,
  isSessionEngineEnabled,
  SessionError,
} from '@/lib/session/sessionEngine';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { markExplanationViewed } from '@/lib/session/phaseCompletionValidator';
import { logger } from '@/lib/logger';
import { recordSessionEvent } from '@/lib/session/sessionEvents';

export const dynamic = 'force-dynamic';

/**
 * POST /api/session/next
 * Body: { sessionId: string }
 *
 * Advances the session to the next phase in the state machine:
 *   OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE
 *
 * Concurrent calls for the same session are safe: the transition guard
 * will reject the second call with 400 (stale state).
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
    logger.logAPI(req, res, { className: 'SessionNextAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'SessionNextAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.sessionId || typeof body.sessionId !== 'string') {
    res = NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionNextAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const view = await advanceSession(user.id, body.sessionId);
    const phase = getPhaseContent(view.currentPhase);
    const content = await resolvePhaseContent(
      view.currentPhase,
      view.topicId,
      view.sessionId,
      user.id,
    );

    recordSessionEvent({
      sessionId: view.sessionId,
      eventType: 'PHASE_STARTED',
      metadata: {
        studentId: user.id,
        currentPhase: view.currentPhase,
        topicId: view.topicId,
      },
    });

    await emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.STUDENT.SESSION_PHASES,
        userId: user.id,
        courseId: view.topicId,
        metadata: {
          sessionId: view.sessionId,
          topicId: view.topicId,
          currentPhase: view.currentPhase,
        },
      },
      'session.next.phase',
    );

    // ABSTRACTION-02: Mark explanation viewed when student advances to EXPLANATION and receives content.
    if (view.currentPhase === 'EXPLANATION') {
      markExplanationViewed(view.sessionId).catch(() => {});
    }

    if (view.currentPhase === 'EXPLANATION') {
      await emitServerAnalyticsEvent(
        {
          eventType: ANALYTICS_EVENTS.STUDENT.LESSON_VIEWED,
          userId: user.id,
          courseId: view.topicId,
          metadata: {
            sessionId: view.sessionId,
            topicId: view.topicId,
            currentPhase: view.currentPhase,
          },
        },
        'session.next.explanation',
      );
    }

    if (view.currentPhase === 'PRACTICE') {
      await emitServerAnalyticsEvent(
        {
          eventType: ANALYTICS_EVENTS.STUDENT.LESSON_COMPLETED,
          userId: user.id,
          courseId: view.topicId,
          metadata: {
            sessionId: view.sessionId,
            topicId: view.topicId,
            currentPhase: view.currentPhase,
          },
        },
        'session.next.practice',
      );
    }

    res = NextResponse.json({ session: view, phase, content });
  } catch (err) {
    if (err instanceof SessionError) {
      res = NextResponse.json({ error: err.message }, { status: err.status });
    } else {
      logger.error('SessionNextAPI.error', { userId: user.id, error: err });
      res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  logger.logAPI(req, res, { className: 'SessionNextAPI', methodName: 'POST' }, start);
  return res;
}
