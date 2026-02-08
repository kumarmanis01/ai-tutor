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
import fs from 'fs';
import path from 'path';
import { isSystemSettingEnabled } from '@/lib/systemSettings.js';
import { logger } from '@/lib/logger.js';
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types';
import { getNextVersion } from '@/lib/getNextVersion';

/** All difficulty levels to generate */
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
type DifficultyLevel = typeof DIFFICULTY_LEVELS[number];

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

    // Subject-specific stricter checks
    try {
      const subjectLower = (subjectName || '').toLowerCase();
      if (subjectLower.includes('math') || subjectLower.includes('mathematics')) {
        // For math, answer should be an object with solution_steps and final_answer
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
  return true;
}

// Exported for unit testing
export { validateQuestionsShape, validateQuestionsShapeWithReport };

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

    try {
      if (subjectLower.includes('math') || subjectLower.includes('mathematics')) {
        if (typeof q.answer !== 'object') { qReport.ok = false; qReport.issues.push('math-answer-not-object'); }
        if (!Array.isArray(q.answer.solution_steps) || q.answer.solution_steps.length === 0) { qReport.ok = false; qReport.issues.push('math-missing-solution_steps'); }
        if (!('final_answer' in q.answer)) { qReport.ok = false; qReport.issues.push('math-missing-final_answer'); }
      }
      if (subjectLower.includes('science')) {
        if (typeof q.answer !== 'object') { qReport.ok = false; qReport.issues.push('science-answer-not-object'); }
        if (!('direct_answer' in q.answer) && !('final_answer' in q.answer)) { qReport.ok = false; qReport.issues.push('science-missing-direct_answer'); }
        if (!q.answer.scientific_explanation && !q.answer.explanation) { qReport.ok = false; qReport.issues.push('science-missing-explanation'); }
      }
    } catch {
      qReport.ok = false; qReport.issues.push('subject-validation-exception');
    }

    if (qReport.ok) report.summary.validCount += 1; else report.summary.issues.push({ index: idx, issues: qReport.issues });
    report.questionReports.push(qReport);
  }

  const valid = report.summary.validCount === report.summary.total && report.summary.issues.length === 0;
  return { valid, report };
}

/**
 * Sanitizes LLM output by stripping code fences.
 */
function _sanitizeLLMOutput(content: string): string {
  if (!content || typeof content !== 'string') return content;
  let s = content.trim();

  // Strip triple-backtick fences
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
    const closingFence = s.lastIndexOf('```');
    if (closingFence !== -1) s = s.slice(0, closingFence);
    s = s.trim();
  }

  // Handle single backticks
  if (s.startsWith('`') && s.endsWith('`')) s = s.slice(1, -1).trim();

  return s;
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
  language: string,
  jobId?: string
): Promise<{ parsed: any; llmResult: any } | null> {
  const difficultyDescriptions: Record<DifficultyLevel, string> = {
    easy: 'basic recall and simple understanding questions suitable for beginners',
    medium: 'application and comprehension questions requiring moderate thinking',
    hard: 'analysis and evaluation questions that challenge advanced understanding'
  };

  const prompt = `You are an expert educator and assessment designer.

Generate 5 ${difficulty.toUpperCase()} level questions for students on:
Topic: ${topic.name}
Board: ${board}
Grade: ${grade}
Subject: ${subjectName}
Language: ${language}

Difficulty Description: ${difficultyDescriptions[difficulty]}

Rules:
- Output JSON ONLY
- No explanations outside the JSON
- Questions should be age-appropriate and curriculum-aligned
- Include a mix of MCQ and short answer questions
- Provide correct answers for each question
- For ${difficulty} level: ${difficultyDescriptions[difficulty]}

JSON Schema:
{
  "questions": [
    {
      "type": "mcq" | "short_answer",
      "question": "string",
      "options": ["string"] (for MCQ only, 4 options),
      "answer": "string",
      "explanation": "string"
    }
  ]
}
`;


  try {
    // Attempt to load an external prompt template for this difficulty
    let llmResponse: { content: string };
    try {
      const promptsDir = path.join(process.cwd(), 'prompts');
      const fileName = `questions.${difficulty}.md`;
      const templatePath = path.join(promptsDir, fileName);
      let template = '';
      if (fs.existsSync(templatePath)) {
        template = fs.readFileSync(templatePath, 'utf8');
      }

      const basePath = path.join(promptsDir, 'base_context.md');
      const base = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf8') + '\n' : '';

      const rendered = (base + template)
        .replace(/{chapter_title}/g, '')
        .replace(/{topic_title}/g, topic.name)
        .replace(/{subject}/g, subjectName)
        .replace(/{grade}/g, String(grade))
        .replace(/{board}/g, board)
        .replace(/{language}/g, language);

      // final rendered prompt (base_context.md contains mandatory requirements and tone)
      const finalPrompt = (rendered || prompt);

      llmResponse = await callLLM({
        prompt: finalPrompt,
        meta: { promptType: 'questions', board, grade, subject: subjectName, topic: topic.name, language, difficulty, useRag: true, hydrationJobId: jobId, topicId: topic?.id, suppressLog: true },
        timeoutMs: Number(process.env.QUESTIONS_LLM_TIMEOUT_MS || 30_000)
      });
    } catch {
      // fallback to inline prompt (base_context.md now contains mandatory requirements and tone)
      llmResponse = await callLLM({
        prompt: prompt,
        meta: { promptType: 'questions', board, grade, subject: subjectName, topic: topic.name, language, difficulty, useRag: true, hydrationJobId: jobId, topicId: topic?.id, suppressLog: true },
        timeoutMs: Number(process.env.QUESTIONS_LLM_TIMEOUT_MS || 30_000)
      });
    }
    let raw: any;
    try {
      raw = parseLlmJson(llmResponse.content);
    } catch (err: any) {
      logger.error('generateQuestionsForDifficulty: failed to parse LLM JSON', { difficulty, topic: topic.name, error: String(err) });
      return { parsed: null, llmResult: llmResponse };
    }

    return { parsed: raw, llmResult: llmResponse };
  } catch (err: any) {
    logger.error('generateQuestionsForDifficulty: failed', { difficulty, topic: topic.name, error: err.message });
    return null;
  }
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

  // Check global pause
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Pending } });
    logger.info('handleQuestionsJob: paused, returning to pending', { jobId });
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

  const language = job.language || 'en';
  const board = topic.chapter.subject.class.board.name;
  const grade = topic.chapter.subject.class.grade;
  const subjectName = topic.chapter.subject.name;

  // Log processing started for linked ExecutionJob
  const linkedExecStart = await prisma.executionJob.findFirst({
    where: { payload: { path: ['hydrationJobId'], equals: job.id } }
  }).catch(() => null);
  if (linkedExecStart) {
    await prisma.jobExecutionLog.create({
      data: { jobId: linkedExecStart.id, event: 'PROCESSING_STARTED', prevStatus: linkedExecStart.status, newStatus: linkedExecStart.status, meta: { hydrationJobId: job.id, difficultyLevels: [...DIFFICULTY_LEVELS] } }
    }).catch(() => {});
  }

  // Generate questions for all difficulty levels
  const results: { difficulty: DifficultyLevel; testId: string | null; questionCount: number }[] = [];
  const createdTestIds: string[] = [];

  // Generate questions for all difficulties in parallel (independent leaf tasks)
  const difficultyPromises = DIFFICULTY_LEVELS.map((difficulty) => (async () => {
    // Check for existing approved questions (idempotency)
    const existingApproved = await prisma.generatedTest.findFirst({ where: { topicId, language, difficulty, status: 'approved' } });
    if (existingApproved) return { difficulty, existingApproved, parsed: null };

    const gen = await generateQuestionsForDifficulty(difficulty, topic, board, grade, subjectName, language, job.id);
    return { difficulty, existingApproved: null, parsed: gen?.parsed ?? null, llmResult: gen?.llmResult ?? null };
  })());

  const difficultyResults = await Promise.all(difficultyPromises);

  for (const dr of difficultyResults) {
    const difficulty = dr.difficulty as DifficultyLevel;
    const existingApproved = dr.existingApproved;
    const parsed = dr.parsed;
    const llmResult = (dr as any).llmResult;

    if (existingApproved) {
      logger.info('handleQuestionsJob: approved questions already exist', { jobId, topicId, difficulty });
      results.push({ difficulty, testId: existingApproved.id, questionCount: 0 });
      continue;
    }

    if (!parsed) {
      logger.warn('handleQuestionsJob: failed to generate for difficulty', { jobId, difficulty });
      // Persist failure AIContentLog outside transaction for this difficulty
      try { await prisma.aIContentLog.create({ data: { model: llmResult?.model || 'none', promptType: 'questions', language, success: false, status: 'failed', error: 'llm_parse_failed', requestBody: { jobId, difficulty }, responseBody: { raw: llmResult?.content } } }) } catch {}
      results.push({ difficulty, testId: null, questionCount: 0 });
      continue;
    }

    // Log response received
    const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } }).catch(() => null);
    if (linkedExec) {
      await prisma.jobExecutionLog.create({
        data: { jobId: linkedExec.id, event: 'RESPONSE_RECEIVED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id, difficulty } }
      }).catch(() => {});

      // Strict validation: any validation failure must fail the whole HydrationJob
      try {
        // Emit validation report for observability
        try {
          const { report } = validateQuestionsShapeWithReport(parsed, subjectName);
          await prisma.jobExecutionLog.create({ data: { jobId: linkedExec.id, event: 'VALIDATION_REPORT', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id, difficulty, report } } }).catch(() => {});
        } catch {}

        // Centralized validator - will throw typed errors on failure
        (await import('@/lib/aiOutputValidator')).validateOrThrow(parsed, { jobType: 'questions', language, difficulty, subject: subjectName, topic: topic.name });
      } catch (vErr: any) {
        // Failure contract: mark job failed, persist AIContentLog via helper, then rethrow to abort
        const reason = vErr?.type || vErr?.message || 'validation_failed'
        await markJobFailed(job.id, String(reason));
        throw vErr;
      }
    }

    // Persist all generated tests and questions atomically in a single transaction
    try {
      // Gather parsed items from difficultyResults
      const allParsed = difficultyResults.filter((d: any) => d.parsed).map((d: any) => ({ difficulty: d.difficulty, parsed: d.parsed, llmResult: d.llmResult }));

      if (allParsed.length > 0) {
        // compute versions for each difficulty
        for (const item of allParsed) {
          (item as any).version = await getNextVersion({ topicId, difficulty: item.difficulty, language, type: 'test' });
        }

        const runTxWithRetry = async (work: (tx: any) => Promise<any>, attempts = 3) => {
          let lastErr: any = null;
          for (let i = 0; i < attempts; i++) {
            try {
              return await prisma.$transaction(work);
            } catch (err: any) {
              lastErr = err;
              const msg = String(err?.message || '');
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
          for (const item of allParsed) {
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

            for (const q of item.parsed.questions) {
              await tx.generatedQuestion.create({ data: { testId: upserted.id, type: q.type, question: q.question, options: q.options ?? null, answer: q.answer ?? null, explanation: q.explanation ?? null, marks: q.marks ?? null, sourceJobId: job.id } });
            }

            if (typeof tx.aIContentLog?.create === 'function') {
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
                responseBody: { raw: item.llmResult?.content }
              } });
            }

            created.push(upserted.id);
          }

          // Mark hydration job completed inside the same transaction
          await tx.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true } });

          // Emit JobExecutionLog for any linked ExecutionJob
          const linked = await tx.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
          if (linked) {
            const prevStatus = linked.status ?? null;
            await tx.jobExecutionLog.create({ data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: 'completed', meta: { hydrationJobId: job.id, testIds: created } } });
          }

          return created;
        });

        // record created ids and results
        for (const id of persisted) {
          createdTestIds.push(id);
          results.push({ difficulty: 'unknown' as any, testId: id, questionCount: 0 });
        }
      }
    } catch (err: any) {
      logger.error('handleQuestionsJob: failed to persist tests atomically', { jobId, error: err.message });
      // mark failure
      await markJobFailed(job.id, 'persistence_failed');
      throw err;
    }
  }

  // Determine overall success
  const successfulCount = results.filter(r => r.testId !== null).length;
  const totalQuestions = results.reduce((sum, r) => sum + r.questionCount, 0);

  if (successfulCount === 0) {
    await markJobFailed(job.id, 'all_difficulties_failed');
    throw new Error('all_difficulties_failed');
  }

  // Mark job completed (workers only update their own HydrationJob)
  await prisma.hydrationJob.update({
    where: { id: job.id },
    data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true }
  });

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
        meta: { hydrationJobId: job.id, testIds: createdTestIds, results, totalQuestions, successfulDifficulties: successfulCount }
      }}).catch(() => {});
    }
  } catch { /* ignore */ }

  logger.info('handleQuestionsJob: completed successfully', { 
    jobId, 
    topicId, 
    successfulDifficulties: successfulCount, 
    totalQuestions,
    testIds: createdTestIds 
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
