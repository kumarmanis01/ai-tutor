import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getPhaseContent, isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { logger } from '@/lib/logger';
import type { SessionPhase } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/session/[sessionId]
 *
 * Returns current session state, phase content, and topic metadata.
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

  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId: user.id },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
      homework: {
        where: { studentId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, score: true, dueDate: true },
      },
    },
  });

  if (!session) {
    res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'GET' }, start);
    return res;
  }

  const phaseInfo = getPhaseContent(session.state as SessionPhase);
  const homework = session.homework?.[0] ?? null;

  const content = await resolvePhaseContent(
    session.state as SessionPhase,
    session.topicId,
    session.id,
    user.id,
  );

  res = NextResponse.json({
    session: {
      sessionId: session.id,
      topicId: session.topicId,
      topicName: session.topic.name,
      subject: session.topic.chapter.subject.name,
      chapter: session.topic.chapter.name,
      state: session.state,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    },
    phase: phaseInfo,
    content,
    homework: homework
      ? {
          id: homework.id,
          status: homework.status,
          score: homework.score,
          dueDate: homework.dueDate.toISOString(),
        }
      : null,
  });

  logger.logAPI(req, res, { className: 'SessionDetailAPI', methodName: 'GET' }, start);
  return res;
}
