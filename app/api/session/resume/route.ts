import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/session/resume
 *
 * Returns the most recent in-progress StructuredSession for the
 * authenticated student, or `{ session: null }` if none exists.
 *
 * The `phase` field in the response uses the canonical `currentPhase`
 * value so clients can display the correct resume label.
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionResumeAPI', methodName: 'GET' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ session: null });
    logger.logAPI(req, res, { className: 'SessionResumeAPI', methodName: 'GET' }, start);
    return res;
  }

  const active = await prisma.structuredSession.findFirst({
    where: {
      studentId: user.id,
      state: { not: 'COMPLETE' },
    },
    orderBy: { startedAt: 'desc' },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!active) {
    res = NextResponse.json({ session: null });
    logger.logAPI(req, res, { className: 'SessionResumeAPI', methodName: 'GET' }, start);
    return res;
  }

  res = NextResponse.json({
    session: {
      sessionId: active.id,
      topicId: active.topicId,
      topicName: active.topic.name,
      subject: active.topic.chapter.subject.name,
      chapter: active.topic.chapter.name,
      /** Canonical phase field — used by ResumeSessionCard for the label. */
      phase: active.state,
      currentPhase: active.state,
      startedAt: active.startedAt.toISOString(),
    },
  });

  logger.logAPI(req, res, { className: 'SessionResumeAPI', methodName: 'GET' }, start);
  return res;
}
