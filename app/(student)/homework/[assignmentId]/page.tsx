import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { HomeworkTest } from '@/components/homework/HomeworkTest';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { assignmentId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: `Homework -- Spinzy Academy` };
}

export default async function HomeworkPage({ params }: PageProps) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) redirect('/login');

  const { assignmentId } = params;

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

  const questions = rawQuestions.map((q) => ({
    id: String(q.id ?? ''),
    type: String(q.type ?? 'mcq'),
    prompt: String(q.prompt ?? ''),
    choices: q.choices ?? null,
    difficulty: q.difficulty ? String(q.difficulty) : null,
    // Only include answer/explanation after grading
    ...(isGraded
      ? {
          correctAnswer: q.correctAnswer ? String(q.correctAnswer) : null,
          explanation: q.explanation ? String(q.explanation) : null,
        }
      : {}),
  }));

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
