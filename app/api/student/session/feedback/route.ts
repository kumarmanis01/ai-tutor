import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const authSession = await requireActiveSession();
  if (!authSession) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 });
  }
  const userId = (authSession.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid JSON' }, { status: 400 });
  }

  const { sessionId, rating, phase } = body as Record<string, unknown>;

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'rating must be 1-5' }, { status: 400 });
  }

  logger.info('session_feedback', {
    event: 'session_feedback_submitted',
    context: { userId, sessionId: sessionId ?? null, rating, phase: phase ?? null },
  });

  return NextResponse.json({ ok: true });
}
