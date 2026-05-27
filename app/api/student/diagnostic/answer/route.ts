import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getSession, updateSession } from '@/lib/diagnostics/sessionStore';
import { prisma } from '@/lib/prisma';
import { gradeSingle } from '@/lib/tests';
import { selectNextQuestion, computeSessionTheta } from '@/lib/diagnostics/selector';
import { diagnosticConfig, featureFlags } from '@/lib/config';

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

    // Fetch question to grade (include topicId for concept resolution)
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, type: true, correctAnswer: true, choices: true, topicId: true, prompt: true, difficulty: true },
    });
    if (!question) {
      const res = NextResponse.json({ error: 'Question not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
      return res;
    }

    const grading = gradeSingle(question as any, selectedOption);

    // Resolve topicId -> first conceptId so AnswerEvent has a valid concept reference
    let conceptId: string | undefined;
    if (question.topicId) {
      const concept = await prisma.concept.findFirst({
        where: { topicId: question.topicId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      conceptId = concept?.id;
    }

    // Persist AnswerEvent for audit (conceptId may be undefined if topic has no concepts yet)
    await prisma.answerEvent.create({
      data: {
        studentId: user.id,
        sessionId,
        ...(conceptId ? { conceptId } : {}),
        questionId: question.id,
        isCorrect: grading.correct,
        studentAnswer: selectedOption ?? '',
        source: 'diagnostic',
      } as any,
    });

    // Flag rapid-fire answers (AC-08): timeSpentMs below threshold signals possible gaming.
    const rapidFire = typeof timeSpentMs === 'number' && timeSpentMs < diagnosticConfig.rapidFireThresholdMs;

    // Update session administered list
    const updated = await updateSession(sessionId, {
      administered: [
        ...(s.administered ?? []),
        { questionId, correct: grading.correct, selectedOption, timeSpentMs, timestamp: new Date().toISOString(), rapidFire },
      ],
    });

    const administeredCount = updated?.administered?.length ?? 0;

    // Compute current theta + SE for stopping rules and response payload
    const { theta, se } = await computeSessionTheta(updated as any);

    // Evaluate stopping rules (AC-02): stop when any condition is met
    const hitMaxItems = administeredCount >= diagnosticConfig.maxItems;
    const hitSEThreshold =
      administeredCount >= diagnosticConfig.minItems && se <= diagnosticConfig.seStoppingThreshold;

    type StopReason = 'max_items' | 'se_threshold' | 'pool_exhausted';
    let stopReason: StopReason | null = null;

    if (hitMaxItems) {
      stopReason = 'max_items';
    } else if (hitSEThreshold) {
      stopReason = 'se_threshold';
    }

    const thetaState = { theta: Math.round(theta * 1000) / 1000, se: Math.round(se * 1000) / 1000, answeredCount: administeredCount };

    if (stopReason) {
      const res = NextResponse.json({ success: true, nextQuestion: null, stopReason, thetaState, sessionState: updated });
      logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
      return res;
    }

    // Choose next candidate from pool that is not yet administered
    let nextQuestion = null;
    if (featureFlags.adaptiveDiagnostic) {
      // Use IRT + Fisher-information selector
      try {
        nextQuestion = await selectNextQuestion(updated as any);
      } catch (e) {
        // selector failure: log and fall back to sequential below
        logger.warn('diagnostic.selector failed, falling back to sequential selector', { error: String(e) })
      }
    }

    if (!nextQuestion) {
      const remaining = (updated?.candidateQuestionIds ?? []).filter(
        (id) => !(updated?.administered ?? []).some((a) => a.questionId === id),
      );
      if (remaining.length > 0) {
        const nq = await prisma.question.findUnique({ where: { id: remaining[0] } });
        if (nq) {
          nextQuestion = { id: nq.id, prompt: nq.prompt, options: nq.choices ?? null, difficulty: nq.difficulty ?? null };
        }
      } else {
        // Pool exhausted -- treat as stop
        const res = NextResponse.json({ success: true, nextQuestion: null, stopReason: 'pool_exhausted' as StopReason, thetaState, sessionState: updated });
        logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
        return res;
      }
    }

    const res = NextResponse.json({ success: true, nextQuestion, stopReason: null, thetaState, sessionState: updated });
    logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('diagnostic.answer failed', { error: String(err) })
    const res = NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticAnswerAPI', methodName: 'POST' }, start);
    return res;
  }
}
