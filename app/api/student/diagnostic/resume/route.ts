import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/diagnostics/sessionStore';
import { getPartialDiagnostic } from '@/lib/redis/diagnosticPartial';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const { sessionId, subjectId } = body ?? {};

  try {
    if (typeof sessionId === 'string' && sessionId) {
      const s = await getSession(sessionId);
      if (!s || s.userId !== user.id) {
        const res = NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
        logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
        return res;
      }
      const res = NextResponse.json({ session: s });
      logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
      return res;
    }

    if (typeof subjectId === 'string' && subjectId) {
      const partial = await getPartialDiagnostic(user.id, subjectId);
      if (!partial) {
        const res = NextResponse.json({ found: false });
        logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
        return res;
      }
      const res = NextResponse.json({ found: true, partial });
      logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
      return res;
    }

    const res = NextResponse.json({ error: 'sessionId or subjectId required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.warn('diagnostic.resume failed', { error: String(err) })
    const res = NextResponse.json({ error: 'Failed to resume' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticResumeAPI', methodName: 'POST' }, start);
    return res;
  }
}
