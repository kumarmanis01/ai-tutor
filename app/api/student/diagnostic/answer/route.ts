import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getSession, updateSession } from '@/lib/diagnostics/sessionStore';
import { prisma } from '@/lib/prisma';
import { gradeSingle } from '@/lib/tests';
import { selectNextQuestion } from '@/lib/diagnostics/selector';
import { featureFlags } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const { sessionId, questionId, selectedOption, timeSpentMs = 0 } = body ?? {};
  if (!sessionId || !questionId) {
    const res = NextResponse.json({ error: 'sessionId and questionId required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const s = await getSession(sessionId);
    if (!s || s.userId !== user.id) {
      const res = NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
      logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
      return res;
    }

    // Fetch question to grade
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      const res = NextResponse.json({ error: 'Question not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
      return res;
    }

    const grading = gradeSingle(question as any, selectedOption);

    // Persist AnswerEvent for audit
    await prisma.answerEvent.create({
      data: {
        studentId: user.id,
        sessionId,
        conceptId: question.topicId ? undefined : undefined, // concept resolution handled by bootstrap
        questionId: question.id,
        isCorrect: grading.correct,
        studentAnswer: selectedOption ?? '',
        source: 'diagnostic',
      } as any,
    });

    // Update session administered list
    const updated = await updateSession(sessionId, {
      administered: [...(s.administered ?? []), { questionId, correct: grading.correct, selectedOption, timeSpentMs, timestamp: new Date().toISOString() }],
    });

    // Choose next candidate from pool that is not yet administered
    let nextQuestion = null;
    if (featureFlags.adaptiveDiagnostic) {
      // Use IRT + Fisher-information selector
      try {
        nextQuestion = await selectNextQuestion(updated as any);
      } catch (e) {
        // selector failure: fall back to first remaining
      }
    }

    if (!nextQuestion) {
      const remaining = (updated?.candidateQuestionIds ?? []).filter((id) => !(updated?.administered ?? []).some((a) => a.questionId === id));
      if (remaining.length > 0) {
        const nq = await prisma.question.findUnique({ where: { id: remaining[0] } });
        if (nq) {
          nextQuestion = { id: nq.id, prompt: nq.prompt, options: nq.choices ?? null, difficulty: nq.difficulty ?? null };
        }
      }
    }

    const res = NextResponse.json({ success: true, nextQuestion, sessionState: updated });
    logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    const res = NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
    return res;
  }
}
