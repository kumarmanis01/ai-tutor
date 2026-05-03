/**
 * Core service for on-demand quiz generation.
 *
 * Responsibilities:
 *  1. Scope resolution: translates topic/chapter/subject/studied_so_far into a list of TopicContext.
 *  2. Prompt construction: builds the LLM prompt including grammar questions for language subjects.
 *  3. LLM call with up to 2 retries on parse or validation failure.
 *  4. Validation and normalisation of LLM output.
 *  5. Persistence: writes result to OnDemandQuizRequest.
 *
 * Called by: worker/jobs/onDemandQuizJob.ts (async background processing).
 */

import { prisma } from '@/lib/prisma';
import { callLLM } from '@/lib/callLLM';
import { parseLlmJson } from '@/lib/llm/sanitizeJson';
import { logger } from '@/lib/logger';
import { DifficultyLevel, LanguageCode, Prisma } from '@prisma/client';

// Local string-literal union mirrors the QuizScope Prisma enum to avoid
// a Prisma v6 bundler-resolution quirk where newly-added enums are not
// re-exported at the '@prisma/client' path during incremental type-checks.
type QuizScope = 'topic' | 'chapter' | 'subject' | 'studied_so_far';
import { buildOnDemandQuizPrompt, TopicContext } from './onDemandQuizPrompt';
import {
  normalizeOnDemandOutput,
  assertQuizValid,
  OnDemandQuizOutput,
} from './onDemandQuizValidator';

const MAX_TOPICS_IN_PROMPT = 15;
const MAX_RETRY_ATTEMPTS = 2;
const LLM_TIMEOUT_MS = Number(process.env.ON_DEMAND_QUIZ_LLM_TIMEOUT_MS || 45_000);

// ── Scope resolution ──────────────────────────────────────────────────────────

async function resolveTopicsForScope(
  requestId: string,
  scope: QuizScope,
  opts: {
    userId: string;
    topicId?: string | null;
    chapterId?: string | null;
    subjectId?: string | null;
  }
): Promise<TopicContext[]> {
  switch (scope) {
    case 'topic': {
      if (!opts.topicId) throw new Error('topicId required for scope=topic');
      const topic = await prisma.topicDef.findUnique({
        where: { id: opts.topicId },
        select: { name: true, chapter: { select: { name: true } } },
      });
      if (!topic) throw new Error(`topic_not_found: ${opts.topicId}`);
      return [{ name: topic.name, chapterName: topic.chapter.name }];
    }

    case 'chapter': {
      if (!opts.chapterId) throw new Error('chapterId required for scope=chapter');
      const topics = await prisma.topicDef.findMany({
        where: { chapterId: opts.chapterId, lifecycle: 'active', status: 'approved' },
        select: { name: true, chapter: { select: { name: true } } },
        orderBy: { order: 'asc' },
        take: MAX_TOPICS_IN_PROMPT,
      });
      if (topics.length === 0) throw new Error(`no_topics_in_chapter: ${opts.chapterId}`);
      return topics.map((t: { name: string; chapter: { name: string } }) => ({
        name: t.name,
        chapterName: t.chapter.name,
      }));
    }

    case 'subject': {
      if (!opts.subjectId) throw new Error('subjectId required for scope=subject');
      const topics = await prisma.topicDef.findMany({
        where: {
          chapter: { subjectId: opts.subjectId },
          lifecycle: 'active',
          status: 'approved',
        },
        select: { name: true, chapter: { select: { name: true } } },
        orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
        take: MAX_TOPICS_IN_PROMPT,
      });
      if (topics.length === 0) throw new Error(`no_topics_in_subject: ${opts.subjectId}`);
      return topics.map((t: { name: string; chapter: { name: string } }) => ({
        name: t.name,
        chapterName: t.chapter.name,
      }));
    }

    case 'studied_so_far': {
      // Topics where the student has any recorded progress, most recently studied first.
      const progress = await prisma.studentTopicProgress.findMany({
        where: { studentId: opts.userId },
        select: {
          topic: { select: { name: true, chapter: { select: { name: true } } } },
        },
        orderBy: { lastStudiedAt: 'desc' },
        take: MAX_TOPICS_IN_PROMPT,
      });
      if (progress.length === 0) throw new Error('no_studied_topics_found');
      return progress.map((p: { topic: { name: string; chapter: { name: string } } }) => ({
        name: p.topic.name,
        chapterName: p.topic.chapter.name,
      }));
    }

    default: {
      const _exhaustive: never = scope;
      throw new Error(`unknown_quiz_scope: ${_exhaustive}`);
    }
  }
}

// ── Academic context resolution ────────────────────────────────────────────────

async function resolveAcademicContext(
  userId: string,
  subjectId?: string | null,
  chapterId?: string | null,
  topicId?: string | null
): Promise<{ board: string; grade: number; subjectName: string }> {
  // Try to derive from subjectId first
  if (subjectId) {
    const subject = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: {
        name: true,
        class: { select: { grade: true, board: { select: { name: true } } } },
      },
    });
    if (subject) {
      return {
        subjectName: subject.name,
        grade: subject.class.grade,
        board: subject.class.board.name,
      };
    }
  }

  if (chapterId) {
    const chapter = await prisma.chapterDef.findUnique({
      where: { id: chapterId },
      select: {
        subject: {
          select: {
            name: true,
            class: { select: { grade: true, board: { select: { name: true } } } },
          },
        },
      },
    });
    if (chapter) {
      return {
        subjectName: chapter.subject.name,
        grade: chapter.subject.class.grade,
        board: chapter.subject.class.board.name,
      };
    }
  }

  if (topicId) {
    const topic = await prisma.topicDef.findUnique({
      where: { id: topicId },
      select: {
        chapter: {
          select: {
            subject: {
              select: {
                name: true,
                class: { select: { grade: true, board: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    if (topic) {
      return {
        subjectName: topic.chapter.subject.name,
        grade: topic.chapter.subject.class.grade,
        board: topic.chapter.subject.class.board.name,
      };
    }
  }

  // Fallback: read from user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { grade: true, board: true },
  });
  return {
    subjectName: 'General',
    grade: Number(user?.grade ?? 8),
    board: user?.board ?? 'CBSE',
  };
}

// ── LLM call with retry ───────────────────────────────────────────────────────

async function callLLMWithRetry(
  prompt: string,
  meta: Record<string, unknown>,
  subjectName: string,
  expectedDifficulty: string,
  requestId: string
): Promise<OnDemandQuizOutput> {
  let lastError: Error = new Error('no_attempt_made');

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    let llmResult: Awaited<ReturnType<typeof callLLM>>;
    try {
      llmResult = await callLLM({
        prompt,
        meta: { ...meta, attempt, timeoutMs: LLM_TIMEOUT_MS },
        timeoutMs: LLM_TIMEOUT_MS,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('[onDemandQuizService] LLM call failed', {
        event: 'llm_call_error',
        context: { requestId, attempt, error: lastError.message },
      });
      continue;
    }

    let raw: unknown;
    try {
      raw = parseLlmJson(llmResult.content);
    } catch (parseErr) {
      lastError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      logger.warn('[onDemandQuizService] JSON parse failed', {
        event: 'json_parse_error',
        context: { requestId, attempt, error: lastError.message },
      });
      continue;
    }

    const normalized = normalizeOnDemandOutput(raw);

    try {
      const validated = assertQuizValid(normalized, { subjectName, expectedDifficulty });
      logger.info('[onDemandQuizService] quiz validated', {
        event: 'quiz_validated',
        context: { requestId, attempt, questionCount: validated.questions.length },
      });
      return validated;
    } catch (valErr) {
      lastError = valErr instanceof Error ? valErr : new Error(String(valErr));
      logger.warn('[onDemandQuizService] validation failed', {
        event: 'validation_error',
        context: { requestId, attempt, error: lastError.message },
      });
    }
  }

  throw lastError;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ProcessQuizRequestResult {
  requestId: string;
  questionCount: number;
}

/**
 * Processes a pending OnDemandQuizRequest:
 *  1. Mark as processing.
 *  2. Resolve scope -> topics.
 *  3. Build prompt.
 *  4. Call LLM with retries.
 *  5. Persist result or error.
 */
export async function processOnDemandQuizRequest(
  requestId: string
): Promise<ProcessQuizRequestResult> {
  // Atomically claim the request
  const claimed = await prisma.onDemandQuizRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: 'processing' },
  });
  if (claimed.count === 0) {
    logger.info('[onDemandQuizService] request already claimed or not pending', {
      event: 'request_skip',
      context: { requestId },
    });
    throw new Error('request_already_claimed');
  }

  const req = await prisma.onDemandQuizRequest.findUnique({
    where: { id: requestId },
    select: {
      userId: true,
      scope: true,
      topicId: true,
      chapterId: true,
      subjectId: true,
      difficulty: true,
      language: true,
      questionCount: true,
    },
  });
  if (!req) {
    await markRequestFailed(requestId, 'request_not_found');
    throw new Error('request_not_found');
  }

  try {
    const topics = await resolveTopicsForScope(requestId, req.scope as QuizScope, {
      userId: req.userId,
      topicId: req.topicId,
      chapterId: req.chapterId,
      subjectId: req.subjectId,
    });

    const { board, grade, subjectName } = await resolveAcademicContext(
      req.userId,
      req.subjectId,
      req.chapterId,
      req.topicId
    );

    const scopeLabel = buildScopeLabel(req.scope as QuizScope, topics.length);

    const prompt = buildOnDemandQuizPrompt({
      topics,
      subjectName,
      board,
      grade,
      difficulty: req.difficulty as 'easy' | 'medium' | 'hard',
      language: req.language as 'en' | 'hi',
      totalQuestions: req.questionCount,
      scopeLabel,
    });

    const result = await callLLMWithRetry(
      prompt,
      {
        promptType: 'on_demand_quiz',
        board,
        grade,
        subject: subjectName,
        difficulty: req.difficulty,
        language: req.language,
        topicCount: topics.length,
        requestId,
      },
      subjectName,
      req.difficulty as string,
      requestId
    );

    await prisma.onDemandQuizRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        resultJson: result as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        error: null,
      },
    });

    logger.info('[onDemandQuizService] request completed', {
      event: 'request_completed',
      context: {
        requestId,
        questionCount: result.questions.length,
        subjectName,
        scope: req.scope,
        difficulty: req.difficulty,
      },
    });

    return { requestId, questionCount: result.questions.length };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await markRequestFailed(requestId, errMsg.slice(0, 500));
    throw err;
  }
}

function buildScopeLabel(scope: QuizScope, topicCount: number): string {
  switch (scope) {
    case 'topic':
      return 'single topic';
    case 'chapter':
      return `entire chapter (${topicCount} topic${topicCount !== 1 ? 's' : ''})`;
    case 'subject':
      return `full subject (${topicCount} topic${topicCount !== 1 ? 's' : ''} sampled)`;
    case 'studied_so_far':
      return `topics studied so far (${topicCount} topic${topicCount !== 1 ? 's' : ''})`;
    default:
      return scope;
  }
}

async function markRequestFailed(requestId: string, error: string): Promise<void> {
  try {
    await prisma.onDemandQuizRequest.update({
      where: { id: requestId },
      data: { status: 'failed', error, completedAt: new Date() },
    });
  } catch (updateErr) {
    logger.error('[onDemandQuizService] failed to mark request as failed', {
      event: 'mark_failed_error',
      context: { requestId, error, updateErr: String(updateErr) },
    });
  }
}

// ── Request creation (called from API route) ─────────────────────────────────

export interface CreateQuizRequestInput {
  userId: string;
  scope: QuizScope;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  difficulty?: DifficultyLevel;
  language?: LanguageCode;
  questionCount?: number;
}

const MAX_QUESTION_COUNT = 20;
const MIN_QUESTION_COUNT = 5;
const DEFAULT_QUESTION_COUNT = 10;

/**
 * Creates an OnDemandQuizRequest in pending state.
 * The API route calls this; the BullMQ job processes it asynchronously.
 */
export async function createQuizRequest(
  input: CreateQuizRequestInput
): Promise<{ requestId: string }> {
  const questionCount = Math.min(
    MAX_QUESTION_COUNT,
    Math.max(MIN_QUESTION_COUNT, input.questionCount ?? DEFAULT_QUESTION_COUNT)
  );

  const record = await prisma.onDemandQuizRequest.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      topicId: input.topicId ?? null,
      chapterId: input.chapterId ?? null,
      subjectId: input.subjectId ?? null,
      difficulty: input.difficulty ?? 'medium',
      language: input.language ?? 'en',
      questionCount,
      status: 'pending',
    },
    select: { id: true },
  });

  return { requestId: record.id };
}
