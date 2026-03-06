/**
 * Resolves real learning content for each session phase.
 *
 * EXPLANATION → TopicNote (approved, latest version)
 * PRACTICE    → 5 questions from Question bank (topicId FK)
 * TEST        → GeneratedTest with questions (approved, latest)
 * HOMEWORK    → HomeworkAssignment for this session
 * COMPLETE    → no content needed
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SessionPhase } from '@prisma/client';

// ─── Return Types ────────────────────────────────────────────────────────────

export interface ExplanationContent {
  type: 'explanation';
  noteId: string;
  title: string;
  contentJson: unknown;
}

export interface PracticeContent {
  type: 'practice';
  questions: {
    id: string;
    type: string;
    prompt: string;
    choices: unknown;
    difficulty: string | null;
  }[];
}

export interface TestContent {
  type: 'test';
  testId: string;
  title: string;
  difficulty: string;
  questions: {
    id: string;
    type: string;
    question: string;
    options: unknown;
    explanation: string | null;
  }[];
}

export interface HomeworkContent {
  type: 'homework';
  assignmentId: string;
  status: string;
  dueDate: string;
  score: number | null;
  questions: unknown;
}

export interface CompleteContent {
  type: 'complete';
}

export interface PendingContent {
  type: 'pending';
  message: string;
}

export type PhaseContentData =
  | ExplanationContent
  | PracticeContent
  | TestContent
  | HomeworkContent
  | CompleteContent
  | PendingContent;

// ─── Public API ──────────────────────────────────────────────────────────────

export async function resolvePhaseContent(
  phase: SessionPhase,
  topicId: string,
  sessionId: string,
  studentId: string,
): Promise<PhaseContentData> {
  switch (phase) {
    case 'EXPLANATION':
      return resolveExplanation(topicId);
    case 'PRACTICE':
      return resolvePractice(topicId);
    case 'TEST':
      return resolveTest(topicId);
    case 'HOMEWORK':
      return resolveHomework(sessionId, studentId);
    case 'COMPLETE':
      return { type: 'complete' };
  }
}

// ─── Phase Resolvers ─────────────────────────────────────────────────────────

async function resolveExplanation(topicId: string): Promise<PhaseContentData> {
  const note = await prisma.topicNote.findFirst({
    where: {
      topicId,
      lifecycle: 'active',
      status: 'approved',
    },
    orderBy: [{ version: 'desc' }],
    select: {
      id: true,
      title: true,
      contentJson: true,
    },
  });

  if (!note) {
    // Fall back to draft if no approved note
    const draft = await prisma.topicNote.findFirst({
      where: { topicId, lifecycle: 'active' },
      orderBy: [{ version: 'desc' }],
      select: { id: true, title: true, contentJson: true },
    });

    if (draft) {
      return { type: 'explanation', noteId: draft.id, title: draft.title, contentJson: draft.contentJson };
    }

    logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'EXPLANATION', topicId });
    return { type: 'pending', message: 'Notes for this topic are being generated. Check back soon.' };
  }

  return { type: 'explanation', noteId: note.id, title: note.title, contentJson: note.contentJson };
}

async function resolvePractice(topicId: string): Promise<PhaseContentData> {
  const questions = await prisma.question.findMany({
    where: { topicId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      prompt: true,
      choices: true,
      difficulty: true,
    },
  });

  if (questions.length === 0) {
    logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'PRACTICE', topicId });
    return { type: 'pending', message: 'Practice questions are being generated for this topic.' };
  }

  return { type: 'practice', questions };
}

async function resolveTest(topicId: string): Promise<PhaseContentData> {
  const test = await prisma.generatedTest.findFirst({
    where: {
      topicId,
      lifecycle: 'active',
      status: 'approved',
    },
    orderBy: [{ version: 'desc' }],
    include: {
      questions: {
        select: {
          id: true,
          type: true,
          question: true,
          options: true,
          explanation: true,
        },
      },
    },
  });

  if (!test || test.questions.length === 0) {
    // Fall back to any test (draft) with questions
    const draft = await prisma.generatedTest.findFirst({
      where: { topicId, lifecycle: 'active' },
      orderBy: [{ version: 'desc' }],
      include: {
        questions: {
          select: { id: true, type: true, question: true, options: true, explanation: true },
        },
      },
    });

    if (draft && draft.questions.length > 0) {
      return {
        type: 'test',
        testId: draft.id,
        title: draft.title,
        difficulty: draft.difficulty,
        questions: draft.questions,
      };
    }

    logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'TEST', topicId });
    return { type: 'pending', message: 'A test for this topic is being prepared.' };
  }

  return {
    type: 'test',
    testId: test.id,
    title: test.title,
    difficulty: test.difficulty,
    questions: test.questions,
  };
}

async function resolveHomework(sessionId: string, studentId: string): Promise<PhaseContentData> {
  const hw = await prisma.homeworkAssignment.findFirst({
    where: { sessionId, studentId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      dueDate: true,
      score: true,
      questions: true,
    },
  });

  if (!hw) {
    logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'HOMEWORK', sessionId, studentId });
    return { type: 'pending', message: 'Homework is being prepared for this session.' };
  }

  return {
    type: 'homework',
    assignmentId: hw.id,
    status: hw.status,
    dueDate: hw.dueDate.toISOString(),
    score: hw.score,
    questions: hw.questions,
  };
}
