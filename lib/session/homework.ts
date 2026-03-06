/**
 * Homework Generation
 *
 * Generates a HomeworkAssignment by selecting 5–10 questions from
 * the existing question bank for the topic. Falls back to
 * GeneratedQuestion if the promoted Question pool is too small.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
const DUE_DATE_DAYS = 2;

export interface HomeworkQuestion {
  id: string;
  type: string;
  prompt: string;
  choices: unknown;
  correctAnswer: string | null;
  explanation: string | null;
  difficulty: string | null;
}

/**
 * Create a homework assignment for a student on a given topic,
 * optionally linked to a StructuredSession.
 */
export async function generateHomework(
  studentId: string,
  topicId: string,
  sessionId?: string,
): Promise<{ id: string; questionCount: number }> {
  const questions = await gatherQuestions(topicId);

  if (questions.length === 0) {
    logger.warn('[HOMEWORK_NO_QUESTIONS]', { studentId, topicId });
    throw new Error('No questions available for this topic');
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);

  const assignment = await prisma.homeworkAssignment.create({
    data: {
      studentId,
      topicId,
      sessionId: sessionId ?? null,
      questions: questions as any,
      status: 'PENDING',
      dueDate,
    },
  });

  logger.info('[HOMEWORK_CREATED]', {
    studentId,
    topicId,
    sessionId,
    assignmentId: assignment.id,
    questionCount: questions.length,
    dueDate: dueDate.toISOString(),
  });

  return { id: assignment.id, questionCount: questions.length };
}

async function gatherQuestions(topicId: string): Promise<HomeworkQuestion[]> {
  // Strategy 1: promoted Question bank (topicId FK)
  type BankQuestion = { id: string; type: string; prompt: string; choices: unknown; correctAnswer: string | null; difficulty: string | null };
  const bankQuestions: BankQuestion[] = await prisma.question.findMany({
    where: { topicId },
    take: MAX_QUESTIONS * 2,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      difficulty: true,
    },
  });

  if (bankQuestions.length >= MIN_QUESTIONS) {
    return shuffle(bankQuestions)
      .slice(0, MAX_QUESTIONS)
      .map((q): HomeworkQuestion => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
        explanation: null,
        difficulty: q.difficulty,
      }));
  }

  // Strategy 2: fall back to GeneratedQuestion via GeneratedTest
  const genTests = await prisma.generatedTest.findMany({
    where: { topicId, lifecycle: 'active' },
    include: {
      questions: {
        select: {
          id: true,
          type: true,
          question: true,
          options: true,
          answer: true,
          explanation: true,
        },
      },
    },
    take: 3,
  });

  const genQuestions = genTests.flatMap((t) => t.questions);
  const combined = [
    ...bankQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      choices: q.choices,
      correctAnswer: q.correctAnswer,
      explanation: null as string | null,
      difficulty: q.difficulty,
    })),
    ...genQuestions.map((gq) => ({
      id: gq.id,
      type: gq.type || 'mcq',
      prompt: gq.question,
      choices: gq.options,
      correctAnswer: typeof gq.answer === 'string' ? gq.answer : JSON.stringify(gq.answer),
      explanation: gq.explanation,
      difficulty: null as string | null,
    })),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = combined.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });

  return shuffle(unique).slice(0, MAX_QUESTIONS);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
