import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  getSessionView,
  getPhaseContent,
  isSessionEngineEnabled,
  SessionError,
} from '@/lib/session/sessionEngine';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { markExplanationViewed } from '@/lib/session/phaseCompletionValidator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/session/[sessionId]
 *
 * COUPLING-03: Uses SessionEngine.getSessionView() so response matches
 * startSession and advanceSession. Adds phase, content, homework for detail view.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const start = Date.now();
  let res: Response;
  const { sessionId } = await params;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'GET' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    const view = await getSessionView(user.id, sessionId);

    const phaseInfo = getPhaseContent(view.currentPhase);
    const content = await resolvePhaseContent(
      view.currentPhase,
      view.topicId,
      view.sessionId,
      user.id,
    );

    // ABSTRACTION-02: Mark explanation viewed when student fetches session in EXPLANATION phase.
    if (view.currentPhase === 'EXPLANATION') {
      markExplanationViewed(view.sessionId).catch(() => {});
    }

    let homework: { id: string; status: string; score: number | null; dueDate: string } | null =
      null;
    if (view.homeworkId) {
      const hw = await prisma.homeworkAssignment.findUnique({
        where: { id: view.homeworkId, studentId: user.id },
        select: { id: true, status: true, score: true, dueDate: true },
      });
      if (hw) {
        homework = {
          id: hw.id,
          status: hw.status,
          score: hw.score,
          dueDate: hw.dueDate.toISOString(),
        };
      }
    }

    res = NextResponse.json({
      session: view,
      phase: phaseInfo,
      content,
      homework,
    });
  } catch (err) {
    if (err instanceof SessionError) {
      if (err.status === 404) {
        res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
      } else if (err.status === 410) {
        const details = (err as SessionError & { details?: { topicId?: string } }).details;
        res = NextResponse.json(
          {
            error: 'Session expired',
            code: 'SESSION_EXPIRED',
            topicId: details?.topicId ?? null,
          },
          { status: 410 },
        );
      } else {
        res = NextResponse.json({ error: err.message }, { status: err.status });
      }
    } else {
      throw err;
    }
  }

  logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'GET' }, start);
  return res;
}

/**
 * PATCH /api/session/[sessionId]
 * Body: { action: 'heartbeat' }
 *
 * Auto-save heartbeat called by the client every 60 seconds (F-STU-010 AC-06).
 * Updates meta.lastHeartbeatAt on the StructuredSession so progress is never lost on
 * network drop or app close. Owns auth + ownership check before any DB write.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const start = Date.now();
  const { sessionId } = await params;

  const authSession = await getServerSessionForHandlers();
  const userId = authSession?.user?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'PATCH' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'heartbeat') {
    const res = NextResponse.json({ error: 'action must be "heartbeat"' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'PATCH' }, start);
    return res;
  }

  try {
    // Ownership check: verify session belongs to this student before writing.
    const existing = await prisma.structuredSession.findFirst({
      where: { id: sessionId, studentId: userId },
      select: { id: true, state: true, meta: true },
    });

    if (!existing) {
      const res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'PATCH' }, start);
      return res;
    }

    // Terminal sessions should not be touched -- client should not be sending heartbeats.
    if (existing.state === 'COMPLETE' || existing.state === 'EXPIRED') {
      const res = NextResponse.json({ ok: true, skipped: true }, { status: 200 });
      logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'PATCH' }, start);
      return res;
    }

    const now = new Date();
    // StructuredSession uses a meta JSON field; merge in the heartbeat timestamp so
    // the "continue where you left off" engine can surface the most recently active session
    // without a dedicated lastAccessed column (avoids a schema migration).
    const updatedMeta = { ...(typeof existing.meta === 'object' && existing.meta !== null ? existing.meta as Record<string, unknown> : {}), lastHeartbeatAt: now.toISOString() };
    await prisma.structuredSession.update({
      where: { id: sessionId },
      data: { meta: updatedMeta },
    });

    const res = NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'PATCH' }, start);
    return res;
  } catch (err) {
    logger.error('[session/heartbeat] error', {
      className: 'SessionDetailAPI',
      methodName: 'PATCH',
      userId,
      sessionId,
      error: String((err as Error)?.message ?? err),
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'PATCH' }, start);
    return res;
  }
}
