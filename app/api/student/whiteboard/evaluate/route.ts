import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { callTutorLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const EVAL_TIMEOUT_MS = 8_000;

const FALLBACK_FEEDBACK =
  "Great effort putting your working down! Keep exploring this approach -- you are on the right track.";

/**
 * POST /api/student/whiteboard/evaluate
 * Body: { sessionId: string, conceptName: string, canvasDataUrl?: string }
 *
 * Evaluates student working drawn on the whiteboard.
 * Uses text-based evaluation (conceptName + session context) via callTutorLLM.
 * Returns { feedback: string } -- always a single encouraging sentence.
 *
 * AC-04: F-STU-014 Virtual Whiteboard.
 */
export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { sessionId, conceptName } = body ?? {};

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const name = typeof conceptName === 'string' && conceptName ? conceptName : 'this concept';

  const prompt = [
    `A student has submitted their working for "${name}".`,
    'Give a single short sentence (max 20 words) of encouraging, specific feedback.',
    'Acknowledge their effort, highlight one thing they are doing right, and give one gentle nudge toward the next step.',
    'Tone: warm, forward-looking. Never say "wrong", "incorrect", "failed", "missed".',
    'Output ONLY the sentence -- no preamble, no quotation marks.',
  ].join('\n');

  try {
    const result = await callTutorLLM(
      prompt,
      { callType: 'tutor:eval', studentId: user.id, sessionId },
      EVAL_TIMEOUT_MS,
    );
    const feedback = (result?.content ?? '').trim() || FALLBACK_FEEDBACK;
    logger.info('whiteboard.evaluated', { studentId: user.id, sessionId });
    const res = NextResponse.json({ feedback });
    logger.logAPI(req, res, { className: 'WhiteboardEvaluateAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('WhiteboardEvaluateAPI.error', { userId: user.id, error: err });
    return NextResponse.json({ feedback: FALLBACK_FEEDBACK });
  }
}
