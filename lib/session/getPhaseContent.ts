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
 *   2026-05-09 | copilot      | resolvePractice: promote GeneratedQuestion rows into Question
 *                               table when Question table is empty for a topic, so questions
 *                               are visible immediately after job completion or admin approval
 *                               without requiring a separate sync step.
 *   2026-05-09 | copilot      | skip rejected GeneratedTest rows during practice promotion so
 *                               admin rejections remain hidden to students.
 *   2026-05-09 | copilot      | include correctAnswer in PRACTICE phase question select/mapping
 *                               so UI instant feedback can evaluate correctly.
 *   2026-05-10 | copilot      | dedupe PRACTICE question rows by normalized prompt+choices+answer
 *                               to prevent repeated questions within a single session.
 *   2026-05-10 | copilot      | switch PRACTICE selection from recency ordering to random sampling
 *                               so sessions do not always serve the latest rows.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ApprovalStatus } from '@/lib/ai-engine/types';
import {
  type SessionPhase,
  PHASE_METADATA,
  UPCOMING_PHASES_ORDER,
} from '@/lib/session/sessionEngine';
import { resolveTargetDifficulty } from '@/lib/ai/adaptiveDifficulty';

const PRACTICE_QUESTION_TARGET_COUNT = 5;

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
    correctAnswer: string | null;
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

type PracticeQuestionRow = PracticeContent['questions'][number];

function normalizeTextForQuestionKey(input?: string | null): string {
  return (input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stableValueForQuestionKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableValueForQuestionKey(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${key}:${stableValueForQuestionKey(obj[key])}`)
      .join(',')}}`;
  }

  if (typeof value === 'string') {
    return normalizeTextForQuestionKey(value);
  }

  return String(value ?? '');
}

function getPracticeQuestionKey(question: PracticeQuestionRow): string {
  const promptKey = normalizeTextForQuestionKey(question.prompt);
  const choicesKey = stableValueForQuestionKey(question.choices);
  const answerKey = normalizeTextForQuestionKey(question.correctAnswer);
  return `${promptKey}::${choicesKey}::${answerKey}`;
}

function dedupePracticeQuestions(questions: PracticeQuestionRow[]): PracticeQuestionRow[] {
  const seen = new Set<string>();
  const deduped: PracticeQuestionRow[] = [];

  for (const question of questions) {
    const key = getPracticeQuestionKey(question);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(question);
  }

  return deduped;
}

function pickRandomQuestions(
  questions: PracticeQuestionRow[],
  count: number,
): PracticeQuestionRow[] {
  if (questions.length <= count) {
    return questions;
  }

  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i];
    shuffled[i] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled.slice(0, count);
}

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
  studentMastery?: number | null,
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
    logger.warn('[PHASE_CONTENT_MISSING]', { phase: 'OVERVIEW', topicId, reason: 'topic_not_found' });
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
    const content = (json.content && typeof json.content === 'object')
      ? (json.content as Record<string, unknown>)
      : json;

    summary =
      (typeof content.summary === 'string' && content.summary)
        ? content.summary
        : (typeof content.introduction === 'string' && content.introduction)
          ? content.introduction
          : null;

    if (Array.isArray(content.objectives)) {
      objectives = (content.objectives as unknown[])
        .filter((o): o is string => typeof o === 'string')
        .slice(0, 5);
    }
  }

  const upcomingPhases = UPCOMING_PHASES_ORDER.map(
    (p) => PHASE_METADATA[p].upcomingLabel!,
  );

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
    return { type: 'explanation', noteId: note.id, title: note.title, contentJson: note.contentJson };
  }

  // Draft fallback.
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

/**
 * PRACTICE -- up to 5 questions from the promoted question bank.
 *
 * Adaptive difficulty: queries the target band first (derived from studentMastery).
 * Falls back to any difficulty for the topic when the target band has no questions yet,
 * so the student is never blocked by a content gap.
 */
async function resolvePractice(topicId: string, studentMastery: number | null): Promise<PhaseContentData> {
  const targetDifficulty = resolveTargetDifficulty(studentMastery);
  const questionSelect = {
    id: true,
    type: true,
    prompt: true,
    choices: true,
    difficulty: true,
    correctAnswer: true,
  } as const;

  // Primary: questions at the student's target difficulty band.
  let questions: PracticeQuestionRow[] = await prisma.question.findMany({
    // quarantined questions excluded -- do not remove this filter
    where: { topicId, difficulty: targetDifficulty, status: 'ACTIVE' },
    select: questionSelect,
  }) as PracticeQuestionRow[];
  questions = pickRandomQuestions(
    dedupePracticeQuestions(questions),
    PRACTICE_QUESTION_TARGET_COUNT,
  );

  // Fallback: any available questions for the topic (content may not yet cover all bands),
  // or use it to top up when dedupe removes duplicate rows from the primary difficulty band.
  if (questions.length < PRACTICE_QUESTION_TARGET_COUNT) {
    const fallbackQuestions: PracticeQuestionRow[] = await prisma.question.findMany({
      // quarantined questions excluded -- do not remove this filter
      where: { topicId, status: 'ACTIVE' },
      select: questionSelect,
    }) as PracticeQuestionRow[];
    questions = pickRandomQuestions(
      dedupePracticeQuestions([...questions, ...fallbackQuestions]),
      PRACTICE_QUESTION_TARGET_COUNT,
    );
  }

  if (questions.length === 0) {
    // Fallback: promote GeneratedQuestion rows into the Question table when the Question
    // bank is empty. This handles cases where the worker soft-sync was not yet in place,
    // where the soft-sync failed transiently, or where admin approved a GeneratedTest but
    // the sync had not yet been triggered. quarantined/rejected rows are preserved via
    // upsert update:{} -- only new rows are created with ACTIVE status.
    try {
      const generatedRows = await prisma.generatedQuestion.findMany({
        where: { test: { topicId, status: { not: ApprovalStatus.Rejected } } },
        select: {
          id: true,
          type: true,
          question: true,
          options: true,
          answer: true,
          test: {
            select: {
              difficulty: true,
              topicId: true,
              topic: {
                select: {
                  chapter: {
                    select: {
                      name: true,
                      subject: {
                        select: {
                          name: true,
                          class: {
                            select: {
                              grade: true,
                              board: { select: { slug: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (generatedRows.length > 0) {
        const existingActiveQuestions = await prisma.question.findMany({
          where: { topicId, status: 'ACTIVE' },
          select: {
            id: true,
            type: true,
            prompt: true,
            choices: true,
            difficulty: true,
            correctAnswer: true,
          },
        });
        const existingKeys = new Set<string>(
          (existingActiveQuestions as PracticeQuestionRow[]).map((q) => getPracticeQuestionKey(q)),
        );
        const promotedKeys = new Set<string>();
        let promotedCount = 0;

        for (const gq of generatedRows) {
          const correctAnswer =
            typeof gq.answer === 'string' ? gq.answer : JSON.stringify(gq.answer ?? '');
          const contentKey = getPracticeQuestionKey({
            id: gq.id,
            type: gq.type || 'mcq',
            prompt: gq.question,
            choices: gq.options ?? undefined,
            difficulty: gq.test.difficulty ?? null,
            correctAnswer,
          });
          if (existingKeys.has(contentKey) || promotedKeys.has(contentKey)) {
            continue;
          }

          const ch = gq.test.topic?.chapter;
          const sub = ch?.subject;
          const cls = sub?.class;
          await prisma.question.upsert({
            where: { id: gq.id },
            update: {},
            create: {
              id: gq.id,
              type: gq.type || 'mcq',
              prompt: gq.question,
              choices: gq.options ?? undefined,
              correctAnswer,
              difficulty: gq.test.difficulty ?? null,
              subject: sub?.name ?? null,
              chapter: ch?.name ?? null,
              grade: cls?.grade != null ? String(cls.grade) : null,
              board: cls?.board?.slug ?? null,
              topicId: gq.test.topicId ?? null,
              source: 'generated',
              // status defaults to ACTIVE via schema @default(ACTIVE)
            },
          });
          promotedKeys.add(contentKey);
          promotedCount++;
        }

        logger.info('[PHASE_CONTENT] resolvePractice: promoted GeneratedQuestion rows on-demand', {
          topicId,
          promoted: promotedCount,
        });

        // Re-query after promotion so the caller gets questions in this same request.
        questions = await prisma.question.findMany({
          // quarantined questions excluded -- do not remove this filter
          where: { topicId, status: 'ACTIVE' },
          select: questionSelect,
        }) as PracticeQuestionRow[];
        questions = pickRandomQuestions(
          dedupePracticeQuestions(questions),
          PRACTICE_QUESTION_TARGET_COUNT,
        );
      }
    } catch (syncErr) {
      // Non-fatal: log and fall through to pending state so the student sees
      // the "generating" UI rather than a hard error.
      logger.error('[PHASE_CONTENT] resolvePractice: on-demand GeneratedQuestion promotion failed', {
        topicId,
        error: String(syncErr),
      });
    }
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
async function resolveTest(topicId: string, studentMastery: number | null): Promise<PhaseContentData> {
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
    return { type: 'test', testId: approvedAtBand.id, title: approvedAtBand.title, difficulty: approvedAtBand.difficulty, questions: approvedAtBand.questions };
  }

  // Fallback: any approved test (ignores difficulty band).
  const approvedAny = await prisma.generatedTest.findFirst({
    where: { topicId, lifecycle: 'active', status: 'approved' },
    orderBy: [{ version: 'desc' }],
    include: { questions: questionSelect },
  });

  if (approvedAny && approvedAny.questions.length > 0) {
    return { type: 'test', testId: approvedAny.id, title: approvedAny.title, difficulty: approvedAny.difficulty, questions: approvedAny.questions };
  }

  // Final fallback: draft (content review in progress).
  const draft = await prisma.generatedTest.findFirst({
    where: { topicId, lifecycle: 'active' },
    orderBy: [{ version: 'desc' }],
    include: { questions: questionSelect },
  });

  if (draft && draft.questions.length > 0) {
    return { type: 'test', testId: draft.id, title: draft.title, difficulty: draft.difficulty, questions: draft.questions };
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
