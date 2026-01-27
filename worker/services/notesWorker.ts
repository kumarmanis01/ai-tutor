/**
 * FILE OBJECTIVE:
 * - Worker service handler for NOTES hydration jobs.
 * - Executes LLM call to generate topic notes and persists to TopicNote table.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/notesWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T02:20:00Z | copilot | Phase 3: Created notes worker handler
 * - 2026-01-23T10:00:00Z | copilot | Enhanced prompt with comprehensive schema (sections, keyTerms, practiceQuestions, etc.)
 */

import { prisma } from '@/lib/prisma.js';
import { callLLM } from '@/lib/callLLM.js';
import fs from 'fs';
import path from 'path';
import { isSystemSettingEnabled } from '@/lib/systemSettings.js';
import { logger } from '@/lib/logger.js';
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types';
import { getNextVersion } from '@/lib/getNextVersion';

/**
 * Validates the shape of the LLM response for notes.
 */
function validateNotesShape(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (!raw.title || typeof raw.title !== 'string') return false;
  if (!raw.content || typeof raw.content !== 'object') return false;
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
 * Worker handler for NOTES hydration jobs.
 * Called by contentWorker when job.data.type === 'NOTES'.
 * 
 * @param jobId - The HydrationJob ID to process
 */
export async function handleNotesJob(jobId: string): Promise<void> {
  // Atomically claim the job
  const claim = await prisma.hydrationJob.updateMany({
    where: { id: jobId, status: JobStatus.Pending },
    data: { status: JobStatus.Running, attempts: { increment: 1 } }
  });
  if (claim.count === 0) {
    logger.info('handleNotesJob: job already claimed or not pending', { jobId });
    return;
  }

  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logger.warn('handleNotesJob: job not found', { jobId });
    return;
  }

  // Check global pause
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Pending } });
    logger.info('handleNotesJob: paused, returning to pending', { jobId });
    return;
  }

  const topicId = job.topicId;
  if (!topicId) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'missing_topicId' } });
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
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'topic_not_found' } });
    throw new Error('topic_not_found');
  }

  // Check for existing approved notes (idempotency)
  const existingApproved = await prisma.topicNote.findFirst({
    where: { topicId, language: job.language, status: 'approved' }
  });
  if (existingApproved) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, contentReady: true } });
    logger.info('handleNotesJob: approved notes already exist', { jobId, topicId });
    return;
  }

  const board = topic.chapter.subject.class.board.name;
  const grade = topic.chapter.subject.class.grade;
  const subjectName = topic.chapter.subject.name;
  const language = job.language || 'en';

  // Calculate version
  const version = existingApproved
    ? await getNextVersion({ topicId, language, type: 'note' })
    : 1;

  const studentAge = grade + 5; // Approximate age based on grade

  // Load prompt template from prompts/notes.md and replace placeholders
  const promptsDir = path.join(process.cwd(), 'prompts');
  const basePath = path.join(promptsDir, 'base_context.md');
  const notesTemplatePath = path.join(promptsDir, 'notes.md');
  let promptTemplate = '';
  try {
    const base = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf8') + '\n' : '';
    const tmpl = fs.readFileSync(notesTemplatePath, 'utf8');
    promptTemplate = base + tmpl;
  } catch (err: any) {
    logger.warn('handleNotesJob: failed to load prompt template, falling back to inline prompt', { err: String(err?.message || '') });
    // fallback to previous inline prompt if template missing
    promptTemplate = `You are an expert ${board} educator creating study material for Class ${grade} students.\n\nCreate comprehensive, engaging study notes for:\nTopic: ${topic.name}\nSubject: ${subjectName}\nBoard: ${board}\nGrade: ${grade}\nLanguage: ${language}\n\nAUDIENCE: ${grade}th grade students (age ~${studentAge} years)\n\nREQUIREMENTS:\n- Use simple, age-appropriate language\n- Include relatable real-world examples\n- Make abstract concepts concrete\n- Anticipate common student confusions\n- Align strictly to ${board} curriculum standards\n\nOUTPUT: JSON ONLY (no markdown, no explanations outside JSON)\n`;
  }

  const prompt = promptTemplate
    .replace(/{chapter_title}/g, topic.chapter?.name || '')
    .replace(/{topic_title}/g, topic.name)
    .replace(/{subject}/g, subjectName)
    .replace(/{grade}/g, String(grade))
    .replace(/{board}/g, board)
    .replace(/{language}/g, language);

  let llmResponse: { content: string };
  try {
    llmResponse = await callLLM({
      prompt,
      meta: { promptType: 'notes', board, grade, subject: subjectName, topic: topic.name, language }
    });
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } });
    throw err;
  }

  // Log response received
  try {
    const linkedExec = await prisma.executionJob.findFirst({
      where: { payload: { path: ['hydrationJobId'], equals: job.id } }
    });
    if (linkedExec) {
      await prisma.jobExecutionLog.create({
        data: { jobId: linkedExec.id, event: 'RESPONSE_RECEIVED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id } }
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  // Parse and validate
  let parsed: any;
  try {
    const sanitized = sanitizeLLMOutput(llmResponse.content);
    const raw = JSON.parse(sanitized);
    if (!validateNotesShape(raw)) throw new Error('validation_failed');
    parsed = raw;
  } catch (err: any) {
    logger.error('handleNotesJob: failed to parse LLM output', { jobId, error: err });
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'invalid_llm_output' } });

    // Mark linked ExecutionJob failed
    try {
      const linkedExec = await prisma.executionJob.findFirst({
        where: { payload: { path: ['hydrationJobId'], equals: job.id } }
      });
      if (linkedExec) {
        await prisma.executionJob.update({ where: { id: linkedExec.id }, data: { status: 'failed', lastError: 'invalid_llm_output' } });
        await prisma.jobExecutionLog.create({
          data: { jobId: linkedExec.id, event: 'PARSE_FAILED', prevStatus: linkedExec.status, newStatus: 'failed', message: 'invalid_llm_output', meta: { hydrationJobId: job.id } }
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    throw new Error('invalid_llm_output');
  }

  // Persist notes
  try {
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

    await runTxWithRetry(async (tx) => {
      await tx.topicNote.create({
        data: {
          topicId,
          language,
          version,
          title: parsed.title,
          contentJson: parsed.content,
          source: 'ai',
          status: ApprovalStatus.Draft
        }
      });

      // Mark hydration job completed
      await tx.hydrationJob.update({
        where: { id: job.id },
        data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true }
      });

      // Mark linked ExecutionJob completed
      const linked = await tx.executionJob.findFirst({
        where: { payload: { path: ['hydrationJobId'], equals: job.id } }
      });
      if (linked) {
        const prevStatus = linked.status;
        await tx.executionJob.update({ where: { id: linked.id }, data: { status: 'completed', updatedAt: new Date() } });
        await tx.jobExecutionLog.create({
          data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: 'completed', meta: { hydrationJobId: job.id } }
        });
      }
    });
    logger.info('handleNotesJob: completed successfully', { jobId, topicId });
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } });
    throw err;
  }
}

export default handleNotesJob;
