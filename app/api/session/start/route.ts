/**
 * FILE OBJECTIVE:
 * - Start or resume a structured learning session and return the current phase payload.
 * - Emits session-start analytics and session event records for admin visibility and downstream workflows.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/analytics.routes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | emit canonical student session start analytics on structured session entry
 */

import { NextResponse } from 'next/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
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
 * New sessions always begin at the OVERVIEW phase.
 * If an in-progress session already exists for this student+topic it is
 * resumed (idempotent -- safe to call multiple times).
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
    logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.topicId || typeof body.topicId !== 'string') {
    res = NextResponse.json({ error: 'topicId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionStartAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const view = await startSession(user.id, body.topicId);
    const phase = getPhaseContent(view.currentPhase);
    const content = await resolvePhaseContent(
      view.currentPhase,
      view.topicId,
      view.sessionId,
      user.id,
    );

    // New sessions emit SESSION_STARTED; resumed sessions emit SESSION_OVERVIEW_VIEWED.
    recordSessionEvent({
      sessionId: view.sessionId,
      eventType: view.currentPhase === 'OVERVIEW' ? 'SESSION_STARTED' : 'SESSION_OVERVIEW_VIEWED',
      metadata: {
        studentId: user.id,
        topicId: body.topicId,
        currentPhase: view.currentPhase,
      },
    });

    await emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.STUDENT.SESSION_START,
        userId: user.id,
        courseId: view.topicId,
        metadata: {
          sessionId: view.sessionId,
          topicId: view.topicId,
          currentPhase: view.currentPhase,
          resumed: view.currentPhase !== 'OVERVIEW',
        },
      },
      'session.start',
    );

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
