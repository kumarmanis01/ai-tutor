import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/homework/[assignmentId]
 *
 * Returns a single homework assignment with:
 *   - questions array (prompt, type, choices, difficulty)
 *   - topic context (topicName, chapter, subject) for the DoubtPanel
 *   - status, dueDate, score
 *
 * correctAnswer is intentionally omitted while status is PENDING/OVERDUE.
 * It is included once the assignment is GRADED/SUBMITTED so the results
 * screen can show explanations.
 *
 * Auth: student must own the assignment.
 */
export async function GET(
  req: Request,
  { params }: { params: { assignmentId: string } }
) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'HomeworkDetailAPI', methodName: 'GET' }, start);
    return res;
  }

  const { assignmentId } = params;

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: assignmentId, studentId: user.id },
    select: {
      id: true,
      status: true,
      dueDate: true,
      score: true,
      questions: true,
      topic: {
        select: {
          name: true,
          chapter: {
            select: {
              name: true,
              subject: {
                select: { name: true },
              },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          studentAnswer: true,
          isCorrect: true,
        },
      },
    },
  });

  if (!assignment) {
    res = NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'HomeworkDetailAPI', methodName: 'GET' }, start);
    return res;
  }

  const isGraded = assignment.status === 'GRADED' || assignment.status === 'SUBMITTED';
  const rawQuestions = Array.isArray(assignment.questions) ? assignment.questions as Record<string, unknown>[] : [];

  // Strip correctAnswer + explanation from ungraded assignments
  const questions = rawQuestions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    choices: q.choices ?? null,
    difficulty: q.difficulty ?? null,
    // Only expose answer/explanation once graded
    ...(isGraded
      ? { correctAnswer: q.correctAnswer ?? null, explanation: q.explanation ?? null }
      : {}),
  }));

  // Build answer lookup for results display
  const answerMap: Record<string, { studentAnswer: string; isCorrect: boolean }> = {};
  for (const a of assignment.answers) {
    answerMap[a.questionId] = { studentAnswer: a.studentAnswer, isCorrect: a.isCorrect };
  }

  res = NextResponse.json({
    id: assignment.id,
    status: assignment.status,
    dueDate: assignment.dueDate.toISOString(),
    score: assignment.score,
    questions,
    answers: isGraded ? answerMap : {},
    // Topic context for DoubtPanel
    topicName: assignment.topic.name,
    chapter: assignment.topic.chapter?.name ?? '',
    subject: assignment.topic.chapter?.subject?.name ?? '',
  });

  logger.logAPI(req, res, { className: 'HomeworkDetailAPI', methodName: 'GET' }, start);
  return res;
}
