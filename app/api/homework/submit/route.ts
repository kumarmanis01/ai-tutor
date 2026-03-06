import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { normalizeAnswer } from '@/lib/tests';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { logger } from '@/lib/logger';
import type { HomeworkQuestion } from '@/lib/session/homework';

export const dynamic = 'force-dynamic';

interface SubmitPayload {
  assignmentId: string;
  answers: { questionId: string; answer: string }[];
}

/**
 * POST /api/homework/submit
 *
 * Accepts student answers, auto-grades MCQs, updates assignment
 * status to GRADED, and feeds score back into topic mastery.
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'HomeworkSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = (await req.json().catch(() => null)) as SubmitPayload | null;
  if (!body?.assignmentId || !Array.isArray(body.answers) || body.answers.length === 0) {
    res = NextResponse.json({ error: 'assignmentId and answers[] are required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'HomeworkSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Load assignment ────────────────────────────────────────────────────
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: body.assignmentId, studentId: user.id },
  });

  if (!assignment) {
    res = NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'HomeworkSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  if (assignment.status === 'GRADED' || assignment.status === 'SUBMITTED') {
    res = NextResponse.json({ error: 'Assignment already submitted' }, { status: 409 });
    logger.logAPI(req, res, { className: 'HomeworkSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Build question lookup from the stored JSON ─────────────────────────
  const questions = (assignment.questions as unknown as HomeworkQuestion[]) || [];
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // ── Grade each answer ──────────────────────────────────────────────────
  let correctCount = 0;
  let totalCount = 0;

  const gradedAnswers: {
    questionId: string;
    studentAnswer: string;
    isCorrect: boolean;
    correctAnswer: string | null;
  }[] = [];

  for (const ans of body.answers) {
    const question = questionMap.get(ans.questionId);
    if (!question) continue;

    totalCount++;
    const isCorrect = gradeQuestion(question, ans.answer);
    if (isCorrect) correctCount++;

    gradedAnswers.push({
      questionId: ans.questionId,
      studentAnswer: ans.answer,
      isCorrect,
      correctAnswer: question.correctAnswer,
    });
  }

  const score = totalCount > 0 ? correctCount / totalCount : 0;

  // ── Persist answers ────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    for (const ga of gradedAnswers) {
      await tx.homeworkAnswer.upsert({
        where: {
          assignmentId_questionId: {
            assignmentId: assignment.id,
            questionId: ga.questionId,
          },
        },
        update: {
          studentAnswer: ga.studentAnswer,
          isCorrect: ga.isCorrect,
        },
        create: {
          assignmentId: assignment.id,
          questionId: ga.questionId,
          studentAnswer: ga.studentAnswer,
          isCorrect: ga.isCorrect,
        },
      });
    }

    await tx.homeworkAssignment.update({
      where: { id: assignment.id },
      data: { status: 'GRADED', score },
    });
  });

  // ── Step 5: Update topic mastery ───────────────────────────────────────
  try {
    await updateStudentTopicProgress({
      studentId: user.id,
      topicId: assignment.topicId,
      correctAnswers: correctCount,
      totalAnswers: totalCount,
      activityType: 'HOMEWORK',
    });
  } catch (err) {
    logger.error('[HOMEWORK_PROGRESS_UPDATE_FAILED]', {
      userId: user.id,
      topicId: assignment.topicId,
      error: err,
    });
  }

  // ── Step 6: Observability ──────────────────────────────────────────────
  logger.info('[HOMEWORK_SUBMITTED]', {
    studentId: user.id,
    assignmentId: assignment.id,
    topicId: assignment.topicId,
    totalQuestions: totalCount,
    correctAnswers: correctCount,
    score,
  });

  logger.info('[HOMEWORK_SCORE]', {
    studentId: user.id,
    assignmentId: assignment.id,
    score,
    percentage: Math.round(score * 100),
  });

  logger.info('[TOPIC_MASTERY_UPDATED]', {
    studentId: user.id,
    topicId: assignment.topicId,
    source: 'homework',
    correctCount,
    wrongCount: totalCount - correctCount,
  });

  // ── Response ───────────────────────────────────────────────────────────
  res = NextResponse.json({
    assignmentId: assignment.id,
    status: 'GRADED',
    score,
    percentage: Math.round(score * 100),
    totalQuestions: totalCount,
    correctAnswers: correctCount,
    results: gradedAnswers.map((ga) => ({
      questionId: ga.questionId,
      isCorrect: ga.isCorrect,
      correctAnswer: ga.correctAnswer,
    })),
  });

  logger.logAPI(req, res, { className: 'HomeworkSubmitAPI', methodName: 'POST' }, start);
  return res;
}

// ─── Grading Logic ─────────────────────────────────────────────────────────

function gradeQuestion(question: HomeworkQuestion, studentAnswer: string): boolean {
  if (!question.correctAnswer) return false;

  const type = (question.type || '').toLowerCase();

  if (type === 'mcq' || type === 'multiple_choice') {
    return gradeMCQ(question, studentAnswer);
  }

  // Fallback: normalized text comparison
  return normalizeAnswer(studentAnswer) === normalizeAnswer(question.correctAnswer);
}

function gradeMCQ(question: HomeworkQuestion, studentAnswer: string): boolean {
  const correct = normalizeAnswer(question.correctAnswer ?? '');
  const student = normalizeAnswer(studentAnswer);

  if (student === correct) return true;

  // Handle case where correctAnswer is the option text but student picked a key (A/B/C/D)
  if (Array.isArray(question.choices)) {
    const idx = student.charCodeAt(0) - 'a'.charCodeAt(0);
    if (idx >= 0 && idx < question.choices.length) {
      const optionText = normalizeAnswer(String(question.choices[idx]));
      if (optionText === correct) return true;
    }

    // Reverse: student picked option text, correctAnswer is a key
    const correctIdx = correct.charCodeAt(0) - 'a'.charCodeAt(0);
    if (correctIdx >= 0 && correctIdx < question.choices.length) {
      const correctText = normalizeAnswer(String(question.choices[correctIdx]));
      if (student === correctText) return true;
    }
  }

  return false;
}
