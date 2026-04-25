import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const authSession = await getServerSessionForHandlers();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid JSON' }, { status: 400 });
  }

  const { sessionId, rating, phase } = body as Record<string, unknown>;

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'rating must be 1-5' },
      { status: 400 }
    );
  }

  // Coerce optional string fields; reject anything non-string to avoid log bloat.
  const safeSessionId = typeof sessionId === 'string' && sessionId.length <= 128 ? sessionId : null;
  const safePhase = typeof phase === 'string' && phase.length <= 64 ? phase : null;

  logger.info('session_feedback', {
    event: 'session_feedback_submitted',
    context: { userId, sessionId: safeSessionId, rating, phase: safePhase },
  });

  return NextResponse.json({ ok: true });
}
