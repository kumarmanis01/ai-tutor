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
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
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
      user.id
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
          { status: 410 }
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
