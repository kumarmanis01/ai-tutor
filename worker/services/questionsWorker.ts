/**
 * FILE OBJECTIVE:
 * - Worker service handler for QUESTIONS hydration jobs.
 * - Executes LLM calls to generate topic questions for ALL difficulty levels (easy, medium, hard).
 * - Persists to GeneratedTest + GeneratedQuestion tables.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/questionsWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T02:25:00Z | copilot | Phase 3: Created questions worker handler
 * - 2026-01-22T03:30:00Z | copilot | Fixed schema: use GeneratedTest+GeneratedQuestion instead of questionsJson; added title; propagate failures to ExecutionJob
 * - 2026-01-22T04:45:00Z | copilot | Generate questions for ALL 3 difficulty levels (easy, medium, hard) in one job
 */

import { prisma } from '@/lib/prisma.js';
import { callLLM } from '@/lib/callLLM.js';
import { parseLlmJson } from '@/lib/llm/sanitizeJson'
import { renderTemplate } from '@/prompts/index'
import _fs from 'fs';
import _path from 'path';
import { LanguageCode } from '@prisma/client';
import { isSystemSettingEnabled } from '@/lib/systemSettings.js';
import { logger } from '@/lib/logger.js';
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types';
import { getNextVersion } from '@/lib/getNextVersion';

// If true, write raw LLM output only to worker logs (via logger) and DO NOT persist
// the raw text to `AIContentLog.responseBody.raw`.
const LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY = String(process.env.LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY || '').toLowerCase() === 'true';

function getResponseBodyForDb(parsed: any, llmResult: any) {
  if (LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY) {
    return parsed ? { parsed } : null;
  }
  return { parsed, raw: llmResult?.content };
}

function logRawToConsole(jobId: string, llmResult: any) {
  if (!LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY) return;
  try {
    const raw = llmResult?.content;
    if (!raw) return;
    const snippet = typeof raw === 'string' ? raw.slice(0, 4000) : JSON.stringify(raw).slice(0, 4000);
    logger.info('[LLM_RAW_DEBUG] Raw LLM output (console-only mode)', { jobId, snippet });
  } catch (_e) {}
}
/** All difficulty levels to generate */
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
type DifficultyLevel = typeof DIFFICULTY_LEVELS[number];

/**
 * Returns the validated question count per difficulty level.
 * Reads from VALIDATION_CAP_QUESTIONS_PER_DIFFICULTY env, defaulting to 2 when LLM_MODE=real.
 * Applies this value as a HARD CAP even when a higher per-job override is provided by the reconciler.
 */
function getValidationQuestionCount(jobOverride?: number): number {
  const envCap = Number(process.env.VALIDATION_CAP_QUESTIONS_PER_DIFFICULTY || 0);
  const baseCap =
    envCap > 0
      ? envCap
      : process.env.LLM_MODE === 'real'
      ? 2
      : 5;

  if (jobOverride != null && Number.isFinite(jobOverride) && jobOverride > 0) {
    return Math.min(jobOverride, baseCap);
  }

  return baseCap;
}

/**
 * Validates the shape of the LLM response for questions.
 */
function validateQuestionsShape(raw: any, subjectName?: string): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (!Array.isArray(raw.questions)) return false;
  for (const q of raw.questions) {
    if (!q || typeof q !== 'object') return false;
    if (!q.question || typeof q.question !== 'string') return false;
    if (!q.type || typeof q.type !== 'string') return false;
    // MCQ must have options
    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) return false;
    }
    // answer must exist and not be null
    if (q.answer === null || typeof q.answer === 'undefined') return false;

    // Subject-specific stricter checks only apply to non-MCQ question types.
    // MCQ questions always use a string answer matching one of the options -- the
    // topic-questions prompt generates MCQ exclusively, so enforcing structured
    // object answers (solution_steps / direct_answer) on MCQ would always fail.
    if (q.type !== 'mcq') {
      try {
        const subjectLower = (subjectName || '').toLowerCase();
        if (subjectLower.includes('math') || subjectLower.includes('mathematics')) {
          // For non-MCQ math, answer should be an object with solution_steps and final_answer
          if (typeof q.answer !== 'object') return false;
          if (!Array.isArray(q.answer.solution_steps) || q.answer.solution_steps.length === 0) return false;
          if (!q.answer.final_answer) return false;
        }
        if (subjectLower.includes('science')) {
          if (typeof q.answer !== 'object') return false;
          if (!q.answer.direct_answer) return false;
          if (!q.answer.scientific_explanation) return false;
        }
      } catch {
        // fallback: ensure answer has substantial content
        if (typeof q.answer === 'string' && q.answer.trim().length < 10) return false;
      }
    }
  }
  return true;
}

// Exported for unit testing
export { validateQuestionsShape, validateQuestionsShapeWithReport, normalizeQuestionsOutput };

/**
 * Validate questions and produce a structured report.
 * Returns { valid: boolean, report: { questionReports: [], summary: { total, validCount, issues } } }
 */
function validateQuestionsShapeWithReport(raw: any, subjectName?: string) {
  const report: any = { questionReports: [], summary: { total: 0, validCount: 0, issues: [] } };
  if (!raw || typeof raw !== 'object') {
    report.summary.issues.push('response-not-object');
    return { valid: false, report };
  }
  if (!Array.isArray(raw.questions)) {
    report.summary.issues.push('questions-not-array');
    return { valid: false, report };
  }
  report.summary.total = raw.questions.length;
  const subjectLower = (subjectName || '').toLowerCase();

  for (let idx = 0; idx < raw.questions.length; idx++) {
    const q = raw.questions[idx];
    const qReport: any = { index: idx, ok: true, issues: [] };
    if (!q || typeof q !== 'object') { qReport.ok = false; qReport.issues.push('question-not-object'); }
    if (!q.question || typeof q.question !== 'string') { qReport.ok = false; qReport.issues.push('missing-question-text'); }
    if (!q.type || typeof q.type !== 'string') { qReport.ok = false; qReport.issues.push('missing-type'); }
    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) { qReport.ok = false; qReport.issues.push('mcq-options-invalid'); }
    }
    if (q.answer === null || typeof q.answer === 'undefined') { qReport.ok = false; qReport.issues.push('missing-answer'); }

    // Subject-specific answer-shape checks only for non-MCQ types.
    // MCQ uses string answer = correctAnswer -- structured object checks must not apply.
    if (q.type !== 'mcq') {
      try {
        if (subjectLower.includes('math') || subjectLower.includes('mathematics')) {
          if (typeof q.answer !== 'object') { qReport.ok = false; qReport.issues.push('math-answer-not-object'); }
          if (!Array.isArray(q.answer?.solution_steps) || q.answer.solution_steps.length === 0) { qReport.ok = false; qReport.issues.push('math-missing-solution_steps'); }
          if (!q.answer || !('final_answer' in q.answer)) { qReport.ok = false; qReport.issues.push('math-missing-final_answer'); }
        }
        if (subjectLower.includes('science')) {
          if (typeof q.answer !== 'object') { qReport.ok = false; qReport.issues.push('science-answer-not-object'); }
          if (!q.answer || (!('direct_answer' in q.answer) && !('final_answer' in q.answer))) { qReport.ok = false; qReport.issues.push('science-missing-direct_answer'); }
          if (!q.answer?.scientific_explanation && !q.answer?.explanation) { qReport.ok = false; qReport.issues.push('science-missing-explanation'); }
        }
      } catch {
        qReport.ok = false; qReport.issues.push('subject-validation-exception');
      }
    }

    if (qReport.ok) report.summary.validCount += 1; else report.summary.issues.push({ index: idx, issues: qReport.issues });
    report.questionReports.push(qReport);
  }

  const valid = report.summary.validCount === report.summary.total && report.summary.issues.length === 0;
  return { valid, report };
}

/**
 * Normalizes raw LLM question output into the shape expected by QuestionsSchema.
 *
 * Handles:
 * 1. Bare array → { questions: [...] }
 * 2. Options as keyed object → ordered string array
 * 3. Field-name aliases (correct_answer, answer, correct, correctAnswer) → answer
 *    and correctOptionIndex → resolved answer string
 * 4. Difficulty casing (Easy/EASY → easy)
 * 5. Missing explanation → default stub
 * 6. Trimming question text
 * 7. Missing type → inferred from options presence
 */
function normalizeQuestionsOutput(raw: any, difficulty?: string): any {
  if (raw == null) return raw;

  let data = raw;

  // Rule 1: bare array → wrapped object
  if (Array.isArray(data)) {
    data = { questions: data };
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
    return data;
  }

  const rawShape = {
    topLevelKeys: Object.keys(data),
    questionCount: data.questions.length,
    sampleFields: data.questions[0] ? Object.keys(data.questions[0]) : [],
  };

  const ANSWER_ALIASES: Record<string, boolean> = {
    correct_answer: true,
    correctAnswer: true,
    correct: true,
    answer: true,
  };

  data.questions = data.questions.map((q: any) => {
    if (!q || typeof q !== 'object') return q;
    const out: any = { ...q };

    // Rule 6: trim question text
    if (typeof out.question === 'string') {
      out.question = out.question.trim();
    }

    // Rule 2: options as keyed object → string array
    if (out.options && !Array.isArray(out.options) && typeof out.options === 'object') {
      const sorted = Object.keys(out.options).sort();
      out.options = sorted.map((k: string) => String(out.options[k]));
    }

    // Rule 3: resolve answer from aliases + correctOptionIndex
    if (out.answer === undefined || out.answer === null) {
      for (const alias of Object.keys(ANSWER_ALIASES)) {
        if (alias !== 'answer' && out[alias] !== undefined && out[alias] !== null) {
          out.answer = out[alias];
          delete out[alias];
          break;
        }
      }
    }
    // correctOptionIndex → pick the option string as the answer
    if ((out.answer === undefined || out.answer === null) && typeof out.correctOptionIndex === 'number' && Array.isArray(out.options)) {
      const idx = out.correctOptionIndex;
      if (idx >= 0 && idx < out.options.length) {
        out.answer = out.options[idx];
      }
    }
    // If answer still missing but correctOptionIndex exists as the only "answer" source, keep it as-is
    if (out.answer === undefined || out.answer === null) {
      if (out.correctOptionIndex !== undefined) {
        out.answer = String(out.correctOptionIndex);
      }
    }

    // Rule 7: infer type from structure when missing
    if (!out.type || typeof out.type !== 'string') {
      out.type = Array.isArray(out.options) && out.options.length >= 2 ? 'mcq' : 'short_answer';
    }

    // Rule 4: normalize difficulty casing
    if (typeof out.difficulty === 'string') {
      out.difficulty = out.difficulty.toLowerCase();
    }

    // Rule 5: default explanation stub
    if (!out.explanation || (typeof out.explanation === 'string' && out.explanation.trim().length === 0)) {
      out.explanation = 'Explanation not provided.';
    }

    return out;
  });

  // Attach top-level difficulty if provided and not already present
  if (difficulty && !data.difficulty) {
    data.difficulty = difficulty.toLowerCase();
  }

  const normalizedShape = {
    topLevelKeys: Object.keys(data),
    questionCount: data.questions.length,
    sampleFields: data.questions[0] ? Object.keys(data.questions[0]) : [],
  };

  logger.info('[QUESTION_NORMALIZATION]', { rawShape, normalizedShape });

  return data;
}

/**
 * Generate questions for a single difficulty level.
 * Returns the parsed questions array or null if failed.
 */
async function generateQuestionsForDifficulty(
  difficulty: DifficultyLevel,
  topic: { id?: string; name: string },
  board: string,
  grade: number,
  subjectName: string,
  language: LanguageCode,
  jobId?: string,
  questionsCount?: number,
  ncertContext?: string
): Promise<{ parsed: any; llmResult: any } | null> {
  // Resolve validated question count -- enforces validation cap
  const count = getValidationQuestionCount(questionsCount);

  const difficultyDescriptions: Record<DifficultyLevel, string> = {
    easy: 'basic recall and simple understanding questions suitable for beginners',
    medium: 'application and comprehension questions requiring moderate thinking',
    hard: 'analysis and evaluation questions that challenge advanced understanding',
  };

  // COUPLING-04: Single canonical prompt source -- renderTemplate only.
  const rendered = renderTemplate('topic-questions', {
    topicName: topic.name,
    grade,
    count,
    language: language as 'en' | 'hi',
    board,
    subject: subjectName,
    difficulty,
    difficultyDescription: difficultyDescriptions[difficulty],
    ncertContext,
  });

  // Persist initial AIContentLog with schemaHash and version for observability before calling LLM
  try {
    await prisma.aIContentLog.create({
      data: {
        model: 'pending',
        promptType: 'questions',
        board,
        grade,
        subject: subjectName,
        topic: topic.name,
        language,
        success: false,
        status: 'started',
        requestBody: { jobId, difficulty, renderer: { schemaHash: rendered.schemaHash, version: rendered.version } },
        responseBody: null,
      },
    });
  } catch {}

  const llmResponse = await callLLM({
    prompt: rendered.prompt,
    meta: {
      promptType: 'questions',
      board,
      grade,
      subject: subjectName,
      topic: topic.name,
      language,
      difficulty,
      useRag: true,
      hydrationJobId: jobId,
      topicId: topic?.id,
      suppressLog: true,
      schemaHash: rendered.schemaHash,
      promptVersion: rendered.version,
    },
    timeoutMs: Number(process.env.QUESTIONS_LLM_TIMEOUT_MS || 30_000),
  });

  let raw: any;
  try {
    raw = parseLlmJson(llmResponse.content);
  } catch (err) {
    logger.error('generateQuestionsForDifficulty: failed to parse LLM JSON', { difficulty, topic: topic.name, error: String(err) });
    return { parsed: null, llmResult: llmResponse };
  }

  raw = normalizeQuestionsOutput(raw, difficulty);

  if (!raw || !Array.isArray(raw.questions)) {
    logger.warn('[VALIDATION_DEFENSIVE] generateQuestionsForDifficulty: questions field is not an array after normalization', {
      difficulty,
      topic: topic.name,
      keys: raw && typeof raw === 'object' ? Object.keys(raw) : null,
    });
    return { parsed: null, llmResult: llmResponse };
  }

  return { parsed: raw, llmResult: llmResponse };
}

/**
 * Worker handler for QUESTIONS hydration jobs.
 * Called by contentWorker when job.data.type === 'QUESTIONS'.
 * Generates questions for ALL 3 difficulty levels (easy, medium, hard).
 * 
 * @param jobId - The HydrationJob ID to process
 */
export async function handleQuestionsJob(jobId: string): Promise<void> {
  // Atomically claim the job
  const claim = await prisma.hydrationJob.updateMany({
    where: { id: jobId, status: JobStatus.Pending },
    data: { status: JobStatus.Running, attempts: { increment: 1 }, lockedAt: new Date() }
  });
  if (claim.count === 0) {
    logger.info('handleQuestionsJob: job already claimed or not pending', { jobId });
    return;
  }

  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logger.warn('handleQuestionsJob: job not found', { jobId });
    return;
  }

  // Check global pause -- use Paused status so the resume route can find and re-enqueue this job
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Paused, lockedAt: null } });
    logger.info('handleQuestionsJob: hydration paused, setting job to paused', { jobId });
    return;
  }

  // hierarchyLevel guard: questions jobs are Level 3 (reconciler-created) or Level 0 (manually enqueued).
  // null/undefined = unset (legacy or test stub) -- allowed. Any other level is a routing bug.
  if (job.hierarchyLevel != null && job.hierarchyLevel !== 0 && job.hierarchyLevel !== 3) {
    logger.error('handleQuestionsJob: wrong hierarchyLevel -- refusing to process', {
      jobId, hierarchyLevel: job.hierarchyLevel,
    });
    await markJobFailed(job.id, 'wrong_hierarchy_level');
    return;
  }
  const topicId = job.topicId;
  if (!topicId) {
    await markJobFailed(job.id, 'missing_topicId');
    throw new Error('missing_topicId');
  }

  // Load topic with full academic context
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } }
            }
          }
        }
      }
    }
  });

  if (!topic) {
    await markJobFailed(job.id, 'topic_not_found');
    throw new Error('topic_not_found');
  }

  const language: LanguageCode = (job.language as LanguageCode) || 'en';
  const board = topic.chapter.subject.class.board.name;
  const grade = topic.chapter.subject.class.grade;
  const subjectName = topic.chapter.subject.name;

  // ── Ground questions in NCERT CurriculumChunk content when available ─────────
  let ncertContext: string | undefined
  try {
    const subjectSlug = subjectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const chapterOrder = (topic.chapter as any).order ?? 0
    if (chapterOrder > 0) {
      const chunks = await prisma.curriculumChunk.findMany({
        where: {
          subject: subjectSlug,
          grade: String(grade),
          conceptIds: { hasSome: [`chapter:${chapterOrder}`] },
        },
        select: { content: true },
        orderBy: { createdAt: 'asc' },
        take: 8,
      })
      if (chunks.length > 0) {
        ncertContext = chunks.map((c: { content?: string | null }) => c.content ?? '').filter(Boolean).join('\n\n---\n\n')
        logger.info('[questionsWorker] grounding questions with NCERT chunks', {
          event: 'ncert_grounding',
          context: { jobId: job.id, chapterOrder, subject: subjectSlug, grade, chunkCount: chunks.length },
        })
      } else {
        logger.warn('[questionsWorker] no NCERT chunks for chapter -- using GPT knowledge', {
          event: 'ncert_grounding_fallback',
          context: { jobId: job.id, chapterOrder, subject: subjectSlug, grade },
        })
      }
    }
  } catch (chunkErr) {
    logger.warn('[questionsWorker] CurriculumChunk query failed -- using GPT knowledge', {
      event: 'ncert_grounding_error',
      context: { jobId: job.id, error: String(chunkErr) },
    })
  }

  // Log processing started for linked ExecutionJob
  const linkedExecStart = await prisma.executionJob.findFirst({
    where: { payload: { path: ['hydrationJobId'], equals: job.id } }
  }).catch(() => null);
  if (linkedExecStart) {
    await prisma.jobExecutionLog.create({
      data: { jobId: linkedExecStart.id, event: 'PROCESSING_STARTED', prevStatus: linkedExecStart.status, newStatus: linkedExecStart.status, meta: { hydrationJobId: job.id, difficultyLevels: [...DIFFICULTY_LEVELS] } }
    }).catch(() => {});
  }

  // Read per-difficulty question count from job inputParams (set by reconciler) or fall back to env/default
  const jobQuestionsPerDifficulty = (job.inputParams as any)?.questionsPerDifficulty;
  const resolvedQuestionsCount = getValidationQuestionCount(
    typeof jobQuestionsPerDifficulty === 'number' ? jobQuestionsPerDifficulty : undefined
  );

  logger.info('[VALIDATION] handleQuestionsJob: starting generation', {
    jobId,
    topicId,
    board,
    grade,
    subject: subjectName,
    difficulties: [...DIFFICULTY_LEVELS],
    questionsPerDifficulty: resolvedQuestionsCount,
  });

  // Generate questions for all difficulty levels
  const results: { difficulty: DifficultyLevel; testId: string | null; questionCount: number }[] = [];
  const createdTestIds: string[] = [];
  let totalLLMCalls = 0;
  let totalTokensUsed = 0;
  const sessionStart = Date.now();

  // Generate questions for all difficulties.
  // RISK-06: When LLM_SAFE_MODE=true, run sequentially to respect safe concurrency.
  // Otherwise run in parallel (independent leaf tasks).
  const isSafeMode = String(process.env.LLM_SAFE_MODE || '').toLowerCase() === 'true';

  const runOneDifficulty = async (difficulty: DifficultyLevel) => {
    const existingApproved = await prisma.generatedTest.findFirst({ where: { topicId, language, difficulty, status: 'approved' } });
    if (existingApproved) {
      logger.info('handleQuestionsJob: existing approved questions found -- generating new version', { jobId, topicId, difficulty });
    }
    const gen = await generateQuestionsForDifficulty(difficulty, topic, board, grade, subjectName, language, job.id, resolvedQuestionsCount, ncertContext);
    return { difficulty, existingApproved: existingApproved ?? null, parsed: gen?.parsed ?? null, llmResult: gen?.llmResult ?? null };
  };

  const difficultyResults = isSafeMode
    ? (await (async () => {
        const out: Awaited<ReturnType<typeof runOneDifficulty>>[] = [];
        for (const d of DIFFICULTY_LEVELS) {
          out.push(await runOneDifficulty(d));
        }
        return out;
      })())
    : await Promise.all(DIFFICULTY_LEVELS.map((d) => runOneDifficulty(d)));

  let questionsCompleted = 0;
  let questionsFailed = 0;
  const validatedDifficulties: { difficulty: DifficultyLevel; parsed: any; llmResult: any }[] = [];

  for (const dr of difficultyResults) {
    const difficulty = dr.difficulty as DifficultyLevel;
    const parsed = dr.parsed;
    const llmResult = (dr as any).llmResult;

    // Track LLM call metrics
    if (llmResult) {
      totalLLMCalls += 1;
      totalTokensUsed += llmResult?.usage?.total_tokens ?? 0;
    }

    if (!parsed) {
      logger.error('[QUESTION_GENERATION_FAILURE]', {
        topic: topic.name,
        difficulty,
        errorCode: 'llm_parse_failed',
        validationErrors: null,
        jobId,
        topicId,
        rawContentLength: llmResult?.content?.length ?? 0,
      });
      try {
        logRawToConsole(job.id, llmResult);
        const responseBody = getResponseBodyForDb(null, llmResult);
        await prisma.aIContentLog.create({ data: { model: llmResult?.model || 'none', promptType: 'questions', language, success: false, status: 'failed', error: 'llm_parse_failed', requestBody: { jobId, difficulty }, responseBody } })
      } catch {}
      questionsFailed++;
      results.push({ difficulty, testId: null, questionCount: 0 });
      continue;
    }

    // Guard: warn if LLM returned more questions than the cap
    const returnedCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
    if (returnedCount > resolvedQuestionsCount) {
      logger.warn('[VALIDATION_CAP] questionsWorker: LLM returned more questions than cap -- trimming', {
        jobId,
        difficulty,
        topicId,
        llmReturned: returnedCount,
        cappedTo: resolvedQuestionsCount,
      });
      parsed.questions = parsed.questions.slice(0, resolvedQuestionsCount);
    }

    logger.info('[VALIDATION] questionsWorker: questionCountByDifficulty', {
      jobId,
      difficulty,
      topicId,
      questionCount: parsed.questions?.length ?? 0,
    });

    // Log response received (if linked ExecutionJob exists)
    const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } }).catch(() => null);
    if (linkedExec) {
      await prisma.jobExecutionLog.create({
        data: { jobId: linkedExec.id, event: 'RESPONSE_RECEIVED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id, difficulty } }
      }).catch(() => {});
    }

    // Per-difficulty validation -- failures are isolated and do NOT abort remaining difficulties
    try {
      const { valid, report } = validateQuestionsShapeWithReport(parsed, subjectName);
      if (linkedExec) {
        await prisma.jobExecutionLog
          .create({
            data: {
              jobId: linkedExec.id,
              event: 'VALIDATION_REPORT',
              prevStatus: linkedExec.status,
              newStatus: linkedExec.status,
              meta: { hydrationJobId: job.id, difficulty, report },
            },
          })
          .catch(() => {});
      }
      // If the shape-level validation fails, treat this difficulty as failed
      if (!valid) {
        const shapeError: any = new Error('questions_shape_invalid');
        shapeError.type = 'questions_shape_invalid';
        shapeError.details = report;
        throw shapeError;
      }

      (await import('@/lib/aiOutputValidator')).validateOrThrow(parsed, {
        jobType: 'questions',
        language,
        difficulty,
        subject: subjectName,
        topic: topic.name,
      });

      questionsCompleted++;
      validatedDifficulties.push({ difficulty, parsed, llmResult });
    } catch (vErr: any) {
      const errorCode = vErr?.type || vErr?.message || 'validation_failed';
      logger.error('[QUESTION_GENERATION_FAILURE]', {
        topic: topic.name,
        difficulty,
        errorCode,
        validationErrors: vErr?.details ?? null,
        jobId,
        topicId,
      });
      try {
        logRawToConsole(job.id, llmResult);
        const responseBody = getResponseBodyForDb(null, llmResult);
        await prisma.aIContentLog.create({ data: { model: llmResult?.model || 'none', promptType: 'questions', language, success: false, status: 'failed', error: String(errorCode), requestBody: { jobId, difficulty }, responseBody } })
      } catch {}
      questionsFailed++;
      results.push({ difficulty, testId: null, questionCount: 0 });
    }
  }

  // Only fail the root job if ALL difficulties failed
  if (validatedDifficulties.length === 0) {
    logger.error('[QUESTION_GENERATION_FAILURE] all difficulties failed for topic', {
      topic: topic.name,
      jobId,
      topicId,
      questionsFailed,
      questionsCompleted,
    });
    await markJobFailed(job.id, 'all_difficulties_failed');
    throw new Error('all_difficulties_failed');
  }

  // Persist only the validated difficulties atomically
  try {
    for (const item of validatedDifficulties) {
      (item as any).version = await getNextVersion({ topicId, difficulty: item.difficulty, language, type: 'test' });
    }

    const runTxWithRetry = async (work: (tx: any) => Promise<any>, attempts = 3) => {
      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          // timeout: 30s -- Neon default is 5s which is too short for 10+ operations per topic
          // Cast needed: (tx: any) signature makes TS resolve to the array overload which omits timeout
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return await (prisma.$transaction as any)(work, { timeout: 30000 });
        } catch (err) {
          lastErr = err;
          const msg = String((err as any)?.message || '');
          if (/Transaction not found|Transaction API error/i.test(msg)) {
            const backoff = (i + 1) * 500;
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    };

    const persisted = await runTxWithRetry(async (tx) => {
      const created: string[] = [];
      for (const item of validatedDifficulties) {
        const difficulty = item.difficulty as DifficultyLevel;
        const version = (item as any).version;
        const testTitle = `${topic.name} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`;

        let upserted: any;
        if (typeof tx.generatedTest.upsert === 'function') {
          upserted = await tx.generatedTest.upsert({
            where: { topicId_difficulty_language_version: { topicId, difficulty, language, version } },
            update: { title: testTitle, status: ApprovalStatus.Draft },
            create: { topicId, title: testTitle, language, difficulty, version, status: ApprovalStatus.Draft }
          });
        } else {
          upserted = await tx.generatedTest.create({ data: { topicId, title: testTitle, language, difficulty, version, status: ApprovalStatus.Draft } });
        }

        if (typeof tx.generatedQuestion.deleteMany === 'function') {
          await tx.generatedQuestion.deleteMany({ where: { testId: upserted.id, sourceJobId: job.id } });
        }

        if (!Array.isArray(item.parsed?.questions)) {
          throw new Error('validation_failed_questions_not_array');
        }

        for (const q of item.parsed.questions as any[]) {
          await tx.generatedQuestion.create({ data: { testId: upserted.id, type: q.type, question: q.question, options: q.options ?? null, answer: q.answer ?? null, explanation: q.explanation ?? null, marks: q.marks ?? null, sourceJobId: job.id } });
        }

        if (typeof tx.aIContentLog?.create === 'function') {
          const successResponseBody = getResponseBodyForDb(item.parsed, item.llmResult);
          logRawToConsole(job.id, item.llmResult);
          await tx.aIContentLog.create({ data: {
            model: item.llmResult?.model || 'llm',
            promptType: 'questions',
            board,
            grade,
            subject: subjectName,
            topic: topic.name,
            language,
            ...(topicId ? { topicRef: { connect: { id: topicId } } } : {}),
            tokensIn: item.llmResult?.usage?.prompt_tokens ?? null,
            tokensOut: item.llmResult?.usage?.completion_tokens ?? null,
            tokensUsed: item.llmResult?.usage?.total_tokens ?? null,
            costUsd: item.llmResult?.costUsd ?? null,
            success: true,
            status: 'success',
            requestBody: { difficulty: item.difficulty },
            responseBody: successResponseBody
          } });
        }

        created.push(upserted.id);
        results.push({ difficulty, testId: upserted.id, questionCount: item.parsed.questions.length });
      }

      await tx.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true } });

      const linked = await tx.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linked) {
        const prevStatus = linked.status ?? null;
        await tx.jobExecutionLog.create({ data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: 'completed', meta: { hydrationJobId: job.id, testIds: created } } });
      }

      return created;
    });

    for (const id of persisted) {
      createdTestIds.push(id);
    }
  } catch (err) {
    const errMsg = (err as any)?.message ?? String(err);
    const errCode = (err as any)?.code ?? '';
    logger.error('[VALIDATION_DEFENSIVE] handleQuestionsJob: DB write failed during test persistence', {
      jobId,
      topicId,
      error: errMsg,
      prismaCode: errCode,
      stack: String((err as any)?.stack ?? '').split('\n').slice(0, 4).join(' | '),
    });
    // Store the actual Prisma error so it appears in the admin UI, not just PM2 logs
    await markJobFailed(job.id, `persistence_failed -- ${errCode ? errCode + ': ' : ''}${errMsg}`.slice(0, 250));
    throw err;
  }

  const successfulCount = validatedDifficulties.length;
  const totalQuestions = results.reduce((sum, r) => sum + r.questionCount, 0);

  // Emit JobExecutionLog for observability but DO NOT mutate ExecutionJob
  try {
    const linked = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
    if (linked) {
      const prevStatus = linked.status ?? null;
      await prisma.jobExecutionLog.create({ data: {
        jobId: linked.id,
        event: 'COMPLETED',
        prevStatus,
        newStatus: prevStatus,
        meta: { hydrationJobId: job.id, testIds: createdTestIds, results, totalQuestions, successfulDifficulties: successfulCount, questionsFailed, questionsCompleted }
      }}).catch(() => {});
    }
  } catch { /* ignore */ }

  const executionDurationMs = Date.now() - sessionStart;

  logger.info('[VALIDATION] handleQuestionsJob: session summary', {
    jobId,
    topicId,
    board,
    grade,
    subject: subjectName,
    questionsCompleted,
    questionsFailed,
    questionsGeneratedByDifficulty: Object.fromEntries(
      validatedDifficulties.map((d) => [d.difficulty, d.parsed?.questions?.length ?? 0])
    ),
    totalQuestionsGenerated: totalQuestions,
    totalLLMCallsMade: totalLLMCalls,
    estimatedTokensUsed: totalTokensUsed,
    executionDurationMs,
    successfulDifficulties: successfulCount,
    failedDifficulties: questionsFailed,
    testIds: createdTestIds,
  });
}

/**
 * Helper to mark job as failed and update linked ExecutionJob
 */


async function markJobFailed(jobId: string, error: string): Promise<void> {
  // Ensure lastError follows the strict format <ERROR_CODE>::<short message>
  const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
  const code = inferFailureCodeFromMessage(error);
  const lastError = formatLastError(code, error);

  await prisma.hydrationJob.update({ 
    where: { id: jobId }, 
    data: { status: JobStatus.Failed, lastError }
  });

  try {
    const linked = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: jobId } } });
    if (linked) {
      await prisma.jobExecutionLog.create({ data: { jobId: linked.id, event: 'FAILED', prevStatus: linked.status, newStatus: linked.status, message: lastError, meta: { hydrationJobId: jobId } } }).catch(() => {});
    }
  } catch { /* ignore */ }

  // Persist AIContentLog for observability when failure happens without LLM
  try {
    await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'questions', language: 'en', success: false, status: 'failed', error: lastError, requestBody: { jobId }, responseBody: null } });
  } catch {}
}

export default handleQuestionsJob;
