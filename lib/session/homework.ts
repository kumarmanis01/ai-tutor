/**
 * Homework Generation
 *
 * Generates a HomeworkAssignment by selecting 5-10 questions from
 * the Question bank for the topic. Generated content may still backfill
 * the bank upstream, but student-facing homework always reads from Question.
 *
 * Design decisions:
 *   - generateHomework() NEVER throws for content unavailability.
 *     It only throws for actual infrastructure failures (DB write error).
 *   - A stub assignment (isStub: true) guarantees that resolveHomework()
 *     in getPhaseContent.ts always finds a row, so PendingContent is
 *     never returned and the student is never permanently stuck.
 *   - One internal retry (RETRY_DELAY_MS gap) is applied when the first
 *     gatherQuestions() call returns empty -- covers transient DB hiccups
 *     where a recently completed hydration job is not yet visible.
 *   - isStub is exposed in HomeworkResult so the engine and UI can make
 *     informed decisions (log it, display a "no homework" message, etc.).
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | add Strategy 3 (chapter fallback), guaranteed
 *                               stub creation, internal retry, HomeworkResult type.
 *                               Fixes RISK-01: permanent dead-end in HOMEWORK phase.
 *   2026-04-23T00:00:00Z | copilot | fix(strict): add local types for generated tests/questions to avoid implicit-any callbacks
 *   2026-04-23T05:30:00Z | copilot | fix(strict): coalesce `explanation` to null and annotate sibling topic mapping to remove implicit-any
 *   2026-05-13T00:00:00Z | copilot | unify homework runtime selection on the shared Question bank selector
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { selectQuestions } from '@/lib/tests';

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
 *
 * @param excludeIds         - Question IDs already served in PRACTICE or TEST phases.
 * @param excludeContentKeys - Normalized content keys for questions already served.
 *                             Catches same-content questions that appear with different
 *                             IDs across Question and GeneratedQuestion tables.
 */
export async function generateHomework(
  studentId: string,
  topicId: string,
  sessionId?: string,
  excludeIds?: Set<string>,
  excludeContentKeys?: Set<string>,
): Promise<HomeworkResult> {
  const exclusions = excludeIds ?? new Set<string>();
  const exclusionKeys = excludeContentKeys ?? new Set<string>();
  // First attempt at gathering questions.
  let questions = await gatherQuestions(topicId, exclusions, exclusionKeys);

  // One retry after a short delay -- handles transient DB hiccups where a
  // very recently completed hydration job has not yet been committed.
  if (questions.length === 0) {
    logger.info('[HOMEWORK_RETRY]', {
      studentId,
      topicId,
      sessionId,
      reason: 'no_questions_on_first_attempt',
    });
    await delay(RETRY_DELAY_MS);
    questions = await gatherQuestions(topicId, exclusions, exclusionKeys);
  }

  const isStub = questions.length === 0;

  if (isStub) {
    logger.warn('[HOMEWORK_STUB_CREATED]', {
      studentId,
      topicId,
      sessionId,
      reason: 'no_questions_available_after_question_bank_selection',
      note: 'Empty assignment created to unblock session completion.',
    });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);

  // Only this write can throw -- only on DB/infrastructure failure.
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
 * Gather homework questions from the Question bank only.
 * Returns an empty array when the bank has no usable rows after exclusions.
 *
 * @param excludeIds         - Question IDs already served in PRACTICE or TEST phases.
 * @param excludeContentKeys - Content keys for questions already served.
 *                             Catches same-content questions with different IDs.
 */
async function gatherQuestions(
  topicId: string,
  excludeIds: Set<string>,
  excludeContentKeys: Set<string>,
): Promise<HomeworkQuestion[]> {
  const selectedQuestions = await selectQuestions(
    { topicId },
    MAX_QUESTIONS,
    excludeIds,
    excludeContentKeys,
  );

  if (selectedQuestions.length < MIN_QUESTIONS) {
    logger.warn('[HOMEWORK_QUESTION_BANK_SHORTFALL]', {
      topicId,
      selectedCount: selectedQuestions.length,
      minimumRequired: MIN_QUESTIONS,
    });
  }

  return shuffle(selectedQuestions).slice(0, MAX_QUESTIONS).map((question): HomeworkQuestion => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    explanation: null,
    difficulty: question.difficulty,
  }));
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
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
