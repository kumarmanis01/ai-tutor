/**
 * FILE OBJECTIVE:
 * - Load a student's homework assignment and resolve question content from the Question bank before rendering the shared homework UI.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/questions/QuestionInteractionShell.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | resolve homework question content from the Question bank before rendering
 * - 2026-05-13T00:00:00Z | copilot | await async dynamic route params before reading assignmentId
 */

import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { HomeworkTest } from '@/components/homework/HomeworkTest';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ assignmentId: string }>;
}

export async function generateMetadata(_params: PageProps): Promise<Metadata> {
  return { title: `Homework -- Spinzy Academy` };
}

export default async function HomeworkPage({ params }: PageProps) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) redirect('/login');

  const { assignmentId } = await params;

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: assignmentId, studentId: session.user.id },
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
              subject: { select: { name: true } },
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

  if (!assignment) redirect('/dashboard');

  const isGraded = assignment.status === 'GRADED' || assignment.status === 'SUBMITTED';
  const rawQuestions = Array.isArray(assignment.questions)
    ? (assignment.questions as Record<string, unknown>[])
    : [];
  const questionIds = rawQuestions
    .map((question) => String(question.id ?? ''))
    .filter((questionId) => questionId.length > 0);
  const bankQuestions = questionIds.length > 0
    ? await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          type: true,
          prompt: true,
          choices: true,
          difficulty: true,
          correctAnswer: true,
        },
      })
    : [];
  const bankQuestionMap = new Map<string, any>(bankQuestions.map((question: any) => [question.id, question]));

  const questions = rawQuestions.map((q) => {
    const questionId = String(q.id ?? '');
    const bankQuestion = bankQuestionMap.get(questionId);

    return {
      id: questionId,
      type: bankQuestion?.type ?? String(q.type ?? 'mcq'),
      prompt: bankQuestion?.prompt ?? String(q.prompt ?? ''),
      choices: bankQuestion?.choices ?? q.choices ?? null,
      difficulty: bankQuestion?.difficulty ?? (q.difficulty ? String(q.difficulty) : null),
    // Only include answer/explanation after grading
      ...(isGraded
        ? {
            correctAnswer: bankQuestion?.correctAnswer ?? (q.correctAnswer ? String(q.correctAnswer) : null),
            explanation: q.explanation ? String(q.explanation) : null,
          }
        : {}),
    };
  });

  const answerMap: Record<string, { studentAnswer: string; isCorrect: boolean }> = {};
  if (isGraded) {
    for (const a of assignment.answers) {
      answerMap[a.questionId] = {
        studentAnswer: a.studentAnswer,
        isCorrect: a.isCorrect,
      };
    }
  }

  return (
    <HomeworkTest
      assignmentId={assignment.id}
      questions={questions}
      status={assignment.status}
      dueDate={assignment.dueDate.toISOString()}
      score={assignment.score}
      answers={answerMap}
      topicName={assignment.topic.name}
      chapter={assignment.topic.chapter?.name ?? ''}
      subject={assignment.topic.chapter?.subject?.name ?? ''}
    />
  );
}
