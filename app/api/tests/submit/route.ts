import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { applyGrading, SubmitPayload } from '@/lib/tests';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tests/submit
 * Body: { attemptId: string, answers: [{ questionId, answer, timeSpent? }] }
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const payload = (await req.json().catch(() => null)) as SubmitPayload | null;
  if (!payload?.attemptId || !Array.isArray(payload.answers)) {
    res = NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const attempt = await prisma.testResult.findFirst({ where: { id: payload.attemptId, studentId: user.id } });
  if (!attempt) {
    res = NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const result = await applyGrading(attempt, payload);
  res = NextResponse.json({ attemptId: attempt.id, ...result });
  logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
  return res;
}
