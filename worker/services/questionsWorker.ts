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
function validateQuestionsShape(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (!Array.isArray(raw.questions)) return false;
  for (const q of raw.questions) {
    if (!q || typeof q !== 'object') return false;
    if (!q.question || typeof q.question !== 'string') return false;
    if (!q.type || typeof q.type !== 'string') return false;
  }
  return true;
}

/**
 * Sanitizes LLM output by stripping code fences.
 */
function sanitizeLLMOutput(content: string): string {
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
  topic: { name: string },
  board: string,
  grade: number,
  subjectName: string,
  language: string
): Promise<{ questions: any[] } | null> {
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
        .replace(/{chapter_title}/g, topic.chapter?.name || '')
        .replace(/{topic_title}/g, topic.name)
        .replace(/{subject}/g, subjectName)
        .replace(/{grade}/g, String(grade))
        .replace(/{board}/g, board)
        .replace(/{language}/g, language);

      llmResponse = await callLLM({
        prompt: rendered || prompt,
        meta: { promptType: 'questions', board, grade, subject: subjectName, topic: topic.name, language, difficulty }
      });
    } catch {
      // fallback to inline prompt
      llmResponse = await callLLM({
        prompt,
        meta: { promptType: 'questions', board, grade, subject: subjectName, topic: topic.name, language, difficulty }
      });
    }
    const sanitized = sanitizeLLMOutput(llmResponse.content);
    const raw = JSON.parse(sanitized);
    if (!validateQuestionsShape(raw)) {
      logger.warn('generateQuestionsForDifficulty: validation failed', { difficulty, topic: topic.name });
      return null;
    }
    return raw;
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
    data: { status: JobStatus.Running, attempts: { increment: 1 } }
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
  try {
    const linkedExec = await prisma.executionJob.findFirst({
      where: { payload: { path: ['hydrationJobId'], equals: job.id } }
    });
    if (linkedExec) {
      await prisma.jobExecutionLog.create({
        data: { jobId: linkedExec.id, event: 'PROCESSING_STARTED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id, difficultyLevels: [...DIFFICULTY_LEVELS] } }
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  // Generate questions for all difficulty levels
  const results: { difficulty: DifficultyLevel; testId: string | null; questionCount: number }[] = [];
  const createdTestIds: string[] = [];

  for (const difficulty of DIFFICULTY_LEVELS) {
    // Check for existing approved questions (idempotency)
    const existingApproved = await prisma.generatedTest.findFirst({
      where: { topicId, language, difficulty, status: 'approved' }
    });
    if (existingApproved) {
      logger.info('handleQuestionsJob: approved questions already exist', { jobId, topicId, difficulty });
      results.push({ difficulty, testId: existingApproved.id, questionCount: 0 });
      continue;
    }

    // Generate questions for this difficulty
    const parsed = await generateQuestionsForDifficulty(difficulty, topic, board, grade, subjectName, language);
    
    if (!parsed) {
      logger.warn('handleQuestionsJob: failed to generate for difficulty', { jobId, difficulty });
      results.push({ difficulty, testId: null, questionCount: 0 });
      continue;
    }

    // Log response received
    try {
      const linkedExec = await prisma.executionJob.findFirst({
        where: { payload: { path: ['hydrationJobId'], equals: job.id } }
      });
      if (linkedExec) {
        await prisma.jobExecutionLog.create({
          data: { jobId: linkedExec.id, event: 'RESPONSE_RECEIVED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id, difficulty } }
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    // Persist to database
    try {
        const version = await getNextVersion({ topicId, difficulty, language, type: 'test' });
        const testTitle = `${topic.name} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`;

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

        const test = await runTxWithRetry(async (tx) => {
        const newTest = await tx.generatedTest.create({
          data: {
            topicId,
            title: testTitle,
            language,
            difficulty,
            version,
            status: ApprovalStatus.Draft
          }
        });

        // Create individual question records
        for (const q of parsed.questions) {
          await tx.generatedQuestion.create({
            data: {
              testId: newTest.id,
              type: q.type,
              question: q.question,
              options: q.options ?? null,
              answer: q.answer ?? null,
              marks: q.marks ?? null
            }
          });
        }

        return newTest;
      });

      createdTestIds.push(test.id);
      results.push({ difficulty, testId: test.id, questionCount: parsed.questions.length });
      logger.info('handleQuestionsJob: created test for difficulty', { jobId, difficulty, testId: test.id, questionCount: parsed.questions.length });
    } catch (err: any) {
      logger.error('handleQuestionsJob: failed to persist for difficulty', { jobId, difficulty, error: err.message });
      results.push({ difficulty, testId: null, questionCount: 0 });
    }
  }

  // Determine overall success
  const successfulCount = results.filter(r => r.testId !== null).length;
  const totalQuestions = results.reduce((sum, r) => sum + r.questionCount, 0);

  if (successfulCount === 0) {
    await markJobFailed(job.id, 'all_difficulties_failed');
    throw new Error('all_difficulties_failed');
  }

  // Mark job completed
  await prisma.hydrationJob.update({
    where: { id: job.id },
    data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true }
  });

  // Mark linked ExecutionJob completed
  try {
    const linked = await prisma.executionJob.findFirst({
      where: { payload: { path: ['hydrationJobId'], equals: job.id } }
    });
    if (linked) {
      const prevStatus = linked.status;
      await prisma.executionJob.update({ where: { id: linked.id }, data: { status: 'completed', updatedAt: new Date() } });
      await prisma.jobExecutionLog.create({
        data: { 
          jobId: linked.id, 
          event: 'COMPLETED', 
          prevStatus, 
          newStatus: 'completed', 
          meta: { 
            hydrationJobId: job.id, 
            testIds: createdTestIds,
            results,
            totalQuestions,
            successfulDifficulties: successfulCount
          } 
        }
      });
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
  await prisma.hydrationJob.update({ 
    where: { id: jobId }, 
    data: { status: JobStatus.Failed, lastError: error } 
  });

  try {
    const linked = await prisma.executionJob.findFirst({
      where: { payload: { path: ['hydrationJobId'], equals: jobId } }
    });
    if (linked) {
      await prisma.executionJob.update({ where: { id: linked.id }, data: { status: 'failed', lastError: error } });
      await prisma.jobExecutionLog.create({
        data: { jobId: linked.id, event: 'FAILED', prevStatus: linked.status, newStatus: 'failed', message: error, meta: { hydrationJobId: jobId } }
      }).catch(() => {});
    }
  } catch { /* ignore */ }
}

export default handleQuestionsJob;
