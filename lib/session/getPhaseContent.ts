/**
 * PhaseContentResolver
 *
 * Resolves real learning content for each session phase.
 *
 *   OVERVIEW     → Topic metadata + objectives extracted from the TopicNote (or a lightweight fallback).
 *   EXPLANATION  → Full TopicNote (approved, latest version; draft fallback).
 *   PRACTICE     → 5 questions from the Question bank (topicId FK).
 *   TEST         → GeneratedTest with questions (approved; draft fallback).
 *   HOMEWORK     → HomeworkAssignment for this session.
 *   COMPLETE     → No content -- terminal state.
 *
 * Every resolver returns a `PendingContent` sentinel when no content is
 * available yet, so the UI can display a "generating" state without crashing.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | add resolveOverview() for the new OVERVIEW phase.
 *   2026-03-08 | claude       | Phase 5: added adaptive difficulty -- resolvePhaseContent
 *                               accepts optional studentMastery; resolvePractice/resolveTest
 *                               filter by resolveTargetDifficulty(mastery) with a graceful
 *                               fallback to any-difficulty when content at the target band
 *                               is not yet available. No schema changes.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  type SessionPhase,
  PHASE_METADATA,
  UPCOMING_PHASES_ORDER,
} from '@/lib/session/sessionEngine';
import { resolveTargetDifficulty } from '@/lib/ai/adaptiveDifficulty';

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface OverviewContent {
  type: 'overview';
  topicName: string;
  subject: string;
  chapter: string;
  /** Short summary of what will be covered (from TopicNote.contentJson if available). */
  summary: string | null;
  /** Learning objectives extracted from the TopicNote (max 5). */
  objectives: string[];
  /** Ordered list of phase labels the student will go through after Overview. */
  upcomingPhases: string[];
}

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
  | OverviewContent
  | ExplanationContent
  | PracticeContent
  | TestContent
  | HomeworkContent
  | CompleteContent
  | PendingContent;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve content for the current session phase.
 *
 * @param phase          - Current SessionPhase value.
 * @param topicId        - The topic being studied.
 * @param sessionId      - Used for HOMEWORK content lookup.
 * @param studentId      - Used for HOMEWORK content lookup.
 * @param studentMastery - Optional: StudentTopicProgress.mastery in [0, 1].
 *                         When provided, PRACTICE and TEST resolvers select
 *                         content at the matching difficulty band (easy / medium / hard).
 *                         Omit or pass null to use the 'medium' default (backward-compatible).
 */
export async function resolvePhaseContent(
  phase: SessionPhase,
  topicId: string,
  sessionId: string,
  studentId: string,
  studentMastery?: number | null
): Promise<PhaseContentData> {
  switch (phase) {
    case 'OVERVIEW':
      return resolveOverview(topicId);
    case 'EXPLANATION':
      return resolveExplanation(topicId);
    case 'PRACTICE':
      return resolvePractice(topicId, studentMastery ?? null);
    case 'TEST':
      return resolveTest(topicId, studentMastery ?? null);
    case 'HOMEWORK':
      return resolveHomework(sessionId, studentId);
    case 'COMPLETE':
      return { type: 'complete' };
  }

  // Should be unreachable: ensure function always returns the declared type.
  throw new Error(`Unsupported session phase: ${phase}`);
}

// ─── Phase Resolvers ─────────────────────────────────────────────────────────

/**
 * OVERVIEW -- lightweight topic introduction.
 *
 * Fetches the TopicNote to extract a summary and objectives. If no note exists
 * yet, the card still renders with just the topic name so the student is not
 * blocked from entering the session.
 */
async function resolveOverview(topicId: string): Promise<PhaseContentData> {
  // Fetch the topic itself for name/subject/chapter metadata.
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    select: {
      name: true,
      chapter: {
        select: {
          name: true,
          subject: { select: { name: true } },
        },
      },
    },
  });

  if (!topic) {
    logger.warn('[PHASE_CONTENT_MISSING]', {
      phase: 'OVERVIEW',
      topicId,
      reason: 'topic_not_found',
    });
    return { type: 'pending', message: 'Topic information could not be loaded.' };
  }

  // Try to get the best available TopicNote for summary + objectives.
  const note = await prisma.topicNote.findFirst({
    where: { topicId, lifecycle: 'active' },
    orderBy: [{ status: 'asc' }, { version: 'desc' }], // approved < draft alphabetically; higher version first
    select: { contentJson: true },
  });

  let summary: string | null = null;
  let objectives: string[] = [];

  if (note?.contentJson) {
    const json = note.contentJson as Record<string, unknown>;

    // Unwrap nested content envelope if present (some notes wrap top-level in {content:...}).
    const content =
      json.content && typeof json.content === 'object'
        ? (json.content as Record<string, unknown>)
        : json;

    summary =
      typeof content.summary === 'string' && content.summary
        ? content.summary
        : typeof content.introduction === 'string' && content.introduction
          ? content.introduction
          : null;

    if (Array.isArray(content.objectives)) {
      objectives = (content.objectives as unknown[])
        .filter((o): o is string => typeof o === 'string')
        .slice(0, 5);
    }
  }

  const upcomingPhases = UPCOMING_PHASES_ORDER.map((p) => PHASE_METADATA[p].upcomingLabel!);

  return {
    type: 'overview',
    topicName: topic.name,
    subject: topic.chapter.subject.name,
    chapter: topic.chapter.name,
    summary,
    objectives,
    upcomingPhases,
  };
}

/**
 * EXPLANATION -- full topic notes.
 *
 * Prefers the latest approved note; falls back to the latest draft so students
 * are never blocked even during content review.
 */
async function resolveExplanation(topicId: string): Promise<PhaseContentData> {
  const note = await prisma.topicNote.findFirst({
    where: { topicId, lifecycle: 'active', status: 'approved' },
    orderBy: [{ version: 'desc' }],
    select: { id: true, title: true, contentJson: true },
  });

  if (note) {
    return {
      type: 'explanation',
      noteId: note.id,
      title: note.title,
      contentJson: note.contentJson,
    };
  }

  // Draft fallback.
  const draft = await prisma.topicNote.findFirst({
    where: { topicId, lifecycle: 'active' },
    orderBy: [{ version: 'desc' }],
    select: { id: true, title: true, contentJson: true },
  });

  if (draft) {
    return {
      type: 'explanation',
      noteId: draft.id,
      title: draft.title,
      contentJson: draft.contentJson,
    };
  }

  logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'EXPLANATION', topicId });
  return { type: 'pending', message: 'Notes for this topic are being generated. Check back soon.' };
}

/**
 * PRACTICE -- up to 5 questions from the promoted question bank.
 *
 * Adaptive difficulty: queries the target band first (derived from studentMastery).
 * Falls back to any difficulty for the topic when the target band has no questions yet,
 * so the student is never blocked by a content gap.
 */
async function resolvePractice(
  topicId: string,
  studentMastery: number | null
): Promise<PhaseContentData> {
  const targetDifficulty = resolveTargetDifficulty(studentMastery);
  const questionSelect = {
    id: true,
    type: true,
    prompt: true,
    choices: true,
    difficulty: true,
  } as const;

  // Primary: questions at the student's target difficulty band.
  let questions = await prisma.question.findMany({
    // quarantined questions excluded -- do not remove this filter
    where: { topicId, difficulty: targetDifficulty, status: 'ACTIVE' },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: questionSelect,
  });

  // Fallback: any available questions for the topic (content may not yet cover all bands).
  if (questions.length === 0) {
    questions = await prisma.question.findMany({
      // quarantined questions excluded -- do not remove this filter
      where: { topicId, status: 'ACTIVE' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: questionSelect,
    });
  }

  if (questions.length === 0) {
    logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'PRACTICE', topicId, targetDifficulty });
    return { type: 'pending', message: 'Practice questions are being generated for this topic.' };
  }

  return { type: 'practice', questions };
}

/**
 * TEST -- approved GeneratedTest with questions; difficulty-aware with fallback.
 *
 * Lookup order:
 *   1. Approved test at student's target difficulty band.
 *   2. Any approved test for the topic (difficulty fallback).
 *   3. Draft test at any difficulty (content-in-progress fallback).
 */
async function resolveTest(
  topicId: string,
  studentMastery: number | null
): Promise<PhaseContentData> {
  const targetDifficulty = resolveTargetDifficulty(studentMastery);
  const questionSelect = {
    select: { id: true, type: true, question: true, options: true, explanation: true },
  };

  // Primary: approved test at the student's target difficulty.
  const approvedAtBand = await prisma.generatedTest.findFirst({
    where: { topicId, lifecycle: 'active', status: 'approved', difficulty: targetDifficulty },
    orderBy: [{ version: 'desc' }],
    include: { questions: questionSelect },
  });

  if (approvedAtBand && approvedAtBand.questions.length > 0) {
    return {
      type: 'test',
      testId: approvedAtBand.id,
      title: approvedAtBand.title,
      difficulty: approvedAtBand.difficulty,
      questions: approvedAtBand.questions,
    };
  }

  // Fallback: any approved test (ignores difficulty band).
  const approvedAny = await prisma.generatedTest.findFirst({
    where: { topicId, lifecycle: 'active', status: 'approved' },
    orderBy: [{ version: 'desc' }],
    include: { questions: questionSelect },
  });

  if (approvedAny && approvedAny.questions.length > 0) {
    return {
      type: 'test',
      testId: approvedAny.id,
      title: approvedAny.title,
      difficulty: approvedAny.difficulty,
      questions: approvedAny.questions,
    };
  }

  // Final fallback: draft (content review in progress).
  const draft = await prisma.generatedTest.findFirst({
    where: { topicId, lifecycle: 'active' },
    orderBy: [{ version: 'desc' }],
    include: { questions: questionSelect },
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

  logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'TEST', topicId, targetDifficulty });
  return { type: 'pending', message: 'A test for this topic is being prepared.' };
}

/**
 * HOMEWORK -- HomeworkAssignment created by the engine when entering this phase.
 */
async function resolveHomework(sessionId: string, studentId: string): Promise<PhaseContentData> {
  const hw = await prisma.homeworkAssignment.findFirst({
    where: { sessionId, studentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, dueDate: true, score: true, questions: true },
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
