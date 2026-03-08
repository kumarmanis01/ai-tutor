/**
 * Homework Generation
 *
 * Generates a HomeworkAssignment by selecting 5–10 questions from
 * the existing question bank for the topic. Falls back through three
 * strategies before creating a stub (zero-question) assignment.
 *
 * Fallback order:
 *   Strategy 1 — promoted Question bank (topicId FK)
 *   Strategy 2 — GeneratedQuestion via GeneratedTest (same topic)
 *   Strategy 3 — GeneratedQuestion from sibling topics in same chapter
 *   Stub       — HomeworkAssignment with questions: [] (never throws)
 *
 * Design decisions:
 *   - generateHomework() NEVER throws for content unavailability.
 *     It only throws for actual infrastructure failures (DB write error).
 *   - A stub assignment (isStub: true) guarantees that resolveHomework()
 *     in getPhaseContent.ts always finds a row, so PendingContent is
 *     never returned and the student is never permanently stuck.
 *   - One internal retry (RETRY_DELAY_MS gap) is applied when the first
 *     gatherQuestions() call returns empty — covers transient DB hiccups
 *     where a recently completed hydration job is not yet visible.
 *   - isStub is exposed in HomeworkResult so the engine and UI can make
 *     informed decisions (log it, display a "no homework" message, etc.).
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | add Strategy 3 (chapter fallback), guaranteed
 *                               stub creation, internal retry, HomeworkResult type.
 *                               Fixes RISK-01: permanent dead-end in HOMEWORK phase.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
const DUE_DATE_DAYS = 2;

/** Delay between the first and second gatherQuestions() attempt (ms). */
const RETRY_DELAY_MS = 500;

// ─── Public Types ─────────────────────────────────────────────────────────────

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
 * RISK-07: Validate and serialize HomeworkQuestion[] for Prisma Json field.
 * Ensures each question has required fields and produces JSON-serializable output.
 */
function toHomeworkQuestionsJson(questions: HomeworkQuestion[]): Prisma.InputJsonValue {
  const validated = questions.map((q) => ({
    id: typeof q.id === 'string' ? q.id : String(q.id),
    type: typeof q.type === 'string' ? q.type : 'mcq',
    prompt: typeof q.prompt === 'string' ? q.prompt : '',
    choices: q.choices ?? null,
    correctAnswer: q.correctAnswer ?? null,
    explanation: q.explanation ?? null,
    difficulty: q.difficulty ?? null,
  }));
  return validated as Prisma.InputJsonValue;
}

/**
 * Result returned by generateHomework().
 *
 * `isStub` is true when no questions were available and an empty assignment
 * was created so the student can still complete the session.
 */
export interface HomeworkResult {
  id: string;
  questionCount: number;
  isStub: boolean;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a homework assignment for a student on a given topic,
 * optionally linked to a StructuredSession.
 *
 * Guarantees: never throws for "no questions available".
 * Creates a stub assignment (questions: []) as a last resort so the
 * student can always advance from HOMEWORK → COMPLETE.
 *
 * Throws only on infrastructure failures (e.g. DB write error).
 */
export async function generateHomework(
  studentId: string,
  topicId: string,
  sessionId?: string,
): Promise<HomeworkResult> {
  // First attempt at gathering questions.
  let questions = await gatherQuestions(topicId);

  // One retry after a short delay — handles transient DB hiccups where a
  // very recently completed hydration job has not yet been committed.
  if (questions.length === 0) {
    logger.info('[HOMEWORK_RETRY]', {
      studentId,
      topicId,
      sessionId,
      reason: 'no_questions_on_first_attempt',
    });
    await delay(RETRY_DELAY_MS);
    questions = await gatherQuestions(topicId);
  }

  const isStub = questions.length === 0;

  if (isStub) {
    logger.warn('[HOMEWORK_STUB_CREATED]', {
      studentId,
      topicId,
      sessionId,
      reason: 'no_questions_available_after_all_strategies',
      note: 'Empty assignment created to unblock session completion.',
    });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);

  // Only this write can throw — only on DB/infrastructure failure.
  const assignment = await prisma.homeworkAssignment.create({
    data: {
      studentId,
      topicId,
      sessionId: sessionId ?? null,
      questions: toHomeworkQuestionsJson(questions),
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
    isStub,
    dueDate: dueDate.toISOString(),
  });

  return { id: assignment.id, questionCount: questions.length, isStub };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Attempt to gather questions for the topic via three strategies.
 * Returns an empty array when all strategies fail — never throws.
 */
async function gatherQuestions(topicId: string): Promise<HomeworkQuestion[]> {
  // ── Strategy 1: promoted Question bank (topicId FK) ─────────────────────
  type BankQuestion = {
    id: string;
    type: string;
    prompt: string;
    choices: unknown;
    correctAnswer: string | null;
    difficulty: string | null;
  };

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

  // ── Strategy 2: GeneratedQuestion via GeneratedTest (same topic) ─────────
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
      correctAnswer:
        typeof gq.answer === 'string' ? gq.answer : JSON.stringify(gq.answer),
      explanation: gq.explanation,
      difficulty: null as string | null,
    })),
  ];

  // Deduplicate by id across both sources.
  const seen = new Set<string>();
  const uniqueTopicQuestions = combined.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });

  if (uniqueTopicQuestions.length >= MIN_QUESTIONS) {
    return shuffle(uniqueTopicQuestions).slice(0, MAX_QUESTIONS);
  }

  // ── Strategy 3: chapter-level fallback — sibling topic questions ─────────
  // When the topic itself has insufficient questions, pull from GeneratedTests
  // for other active topics in the same chapter. This mirrors the "PRACTICE
  // questions" pool from getPhaseContent.ts — the same source the PRACTICE
  // and TEST phases draw from.
  const topicDef = await prisma.topicDef.findUnique({
    where: { id: topicId },
    select: { chapterId: true },
  });

  if (topicDef?.chapterId) {
    const siblingTopics = await prisma.topicDef.findMany({
      where: {
        chapterId: topicDef.chapterId,
        lifecycle: 'active',
        id: { not: topicId },
      },
      select: { id: true },
    });

    const siblingIds = siblingTopics.map((t) => t.id);

    if (siblingIds.length > 0) {
      const siblingTests = await prisma.generatedTest.findMany({
        where: { topicId: { in: siblingIds }, lifecycle: 'active' },
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

      // Deduplicate against the topic-level questions already in `seen`.
      const siblingQuestions = siblingTests
        .flatMap((t) => t.questions)
        .filter((gq) => !seen.has(gq.id))
        .map((gq) => ({
          id: gq.id,
          type: gq.type || 'mcq',
          prompt: gq.question,
          choices: gq.options,
          correctAnswer:
            typeof gq.answer === 'string'
              ? gq.answer
              : JSON.stringify(gq.answer),
          explanation: gq.explanation,
          difficulty: null as string | null,
        }));

      if (siblingQuestions.length > 0) {
        logger.info('[HOMEWORK_CHAPTER_FALLBACK]', {
          topicId,
          chapterId: topicDef.chapterId,
          siblingQuestionCount: siblingQuestions.length,
        });

        const allAvailable = [...uniqueTopicQuestions, ...siblingQuestions];
        return shuffle(allAvailable).slice(0, MAX_QUESTIONS);
      }
    }
  }

  // All three strategies exhausted.
  logger.warn('[HOMEWORK_QUESTIONS_EXHAUSTED]', {
    topicId,
    strategiesAttempted: 3,
    note: 'Caller will create a stub assignment.',
  });

  // Return whatever partial set we have (may be []).
  return shuffle(uniqueTopicQuestions).slice(0, MAX_QUESTIONS);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
