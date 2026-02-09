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
import { parseLlmJson } from '@/lib/llm/sanitizeJson';
import { validateOrThrow } from '@/lib/aiOutputValidator';
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
  // content should contain either sections (array) or paragraphs
  const content = raw.content;
  if (Array.isArray(content.sections)) {
    if (content.sections.length === 0) return false;
    for (const s of content.sections) {
      if (!s.heading || typeof s.heading !== 'string') return false;
      if (!s.body || typeof s.body !== 'string') return false;
    }
  } else if (Array.isArray(content.paragraphs)) {
    if (content.paragraphs.length === 0) return false;
    for (const p of content.paragraphs) {
      if (typeof p !== 'string' || p.trim().length === 0) return false;
    }
  } else {
    // accept content with 'explanation' string
    if (!content.explanation || typeof content.explanation !== 'string') return false;
  }

  // require teacher-style elements where applicable
  if (!raw.audience || typeof raw.audience !== 'string') return false;
  return true;
}

// Exported for unit testing
export { validateNotesShape, validateNotesShapeWithReport };

/**
 * Validate notes shape and produce a structured validation report.
 * Returns { valid: boolean, report: { issues: string[], details: {} } }
 */
function validateNotesShapeWithReport(raw: any) {
  const report: any = { issues: [], details: {} };
  if (!raw || typeof raw !== 'object') { report.issues.push('response-not-object'); return { valid: false, report }; }
  if (!raw.title || typeof raw.title !== 'string') { report.issues.push('missing-title'); }
  if (!raw.content || typeof raw.content !== 'object') { report.issues.push('missing-content'); }

  if (raw.content) {
    const content = raw.content;
    if (Array.isArray(content.sections)) {
      if (content.sections.length === 0) report.issues.push('sections-empty');
      content.sections.forEach((s: any, idx: number) => {
        if (!s.heading || typeof s.heading !== 'string') report.issues.push(`section-${idx}-missing-heading`);
        if (!s.body || typeof s.body !== 'string' || s.body.trim().length === 0) report.issues.push(`section-${idx}-missing-body`);
      });
    } else if (Array.isArray(content.paragraphs)) {
      if (content.paragraphs.length === 0) report.issues.push('paragraphs-empty');
      content.paragraphs.forEach((p: any, idx: number) => {
        if (typeof p !== 'string' || p.trim().length === 0) report.issues.push(`paragraph-${idx}-empty`);
      });
    } else {
      if (!content.explanation || typeof content.explanation !== 'string') report.issues.push('missing-explanation');
    }
  }

  if (!raw.audience || typeof raw.audience !== 'string') report.issues.push('missing-audience');

  const valid = report.issues.length === 0;
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
 * Attempt to extract JSON text from an arbitrary LLM output.
 * Tries fenced ```json blocks first, then any fenced block, then the first '{'..'}' span.
 */
function _extractJsonFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  // fenced json block
  const jsonFence = /```json\s*([\s\S]*?)```/i.exec(t);
  if (jsonFence && jsonFence[1]) return jsonFence[1].trim();

  // any fenced block
  const anyFence = /```[\s\S]*?\n([\s\S]*?)```/.exec(t);
  if (anyFence && anyFence[1]) return anyFence[1].trim();

  // attempt to find first { and last }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return t.slice(first, last + 1).trim();
  }

  return null;
}

/**
 * Call LLM and try to parse JSON with a small retry on parse failure.
 * Returns parsed object or throws after retries.
 */
async function callAndParseJSON(prompt: string, meta: any, attempts = 3): Promise<{ parsed: any; llmResult: any }> {
  let lastErr: any = null;
  let prevResponseText: string | null = null;
  for (let i = 0; i < attempts; i++) {
    // Ensure RAG-lite context is used for content generation and bind to hydrationJob when provided
    const timeoutMs = Number(process.env.NOTES_LLM_TIMEOUT_MS || 30_000);
    const callMeta = { ...(meta || {}), useRag: true, hydrationJobId: meta?.hydrationJobId || meta?.jobId || null, suppressLog: true };
    const llmResponse = await callLLM({ prompt, meta: callMeta, timeoutMs });
    const responseText = String(llmResponse.content ?? '');
    prevResponseText = responseText;
    try {
      // Use shared parser which applies sanitization, extraction and repair heuristics
      const parsed = parseLlmJson(responseText);
      return { parsed, llmResult: llmResponse };
    } catch (parseErr: any) {
      lastErr = parseErr;
    }

    // If we have another attempt, re-prompt the model with stricter instructions including the previous output
    if (i + 1 < attempts) {
      const retryPrompt = `${prompt}\n\nRESPONSE CORRECTION: The previous response did not parse as JSON. Return ONLY a valid JSON object matching the required schema. Do NOT include markdown, commentary, or any surrounding text. Here is the previous response for reference:\n\n${prevResponseText}`;
      // lower temperature / stricter settings can be controlled via meta if supported
      meta = { ...(meta || {}), retry: i + 1 };
      try {
        // loop will call LLM again
        prompt = retryPrompt;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error('failed_parse');
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
    data: { status: JobStatus.Running, attempts: { increment: 1 }, lockedAt: new Date() }
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
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.DEPENDENCY_MISSING, 'missing_topicId');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    try { await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId }, responseBody: null } }) } catch {};
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
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.DEPENDENCY_MISSING, 'topic_not_found');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    try { await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId }, responseBody: null } }) } catch {};
    throw new Error('topic_not_found');
  }

  // Check for existing approved notes (idempotency)
  const existingApproved = await prisma.topicNote.findFirst({
    where: { topicId, language: job.language, status: 'approved' }
  });
  if (existingApproved) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, contentReady: true } });
    try { await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'notes', language: job.language || 'en', success: true, status: 'success', requestBody: { jobId }, responseBody: { reason: 'content_exists' } } }) } catch {}
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

  // Call LLM and attempt to parse JSON with retries/extraction heuristics
  let parsed: any;
  let llmResult: any = null;
  try {
    const meta = { promptType: 'notes', board, grade, subject: subjectName, topic: topic.name, language };
    const res = await callAndParseJSON(prompt, meta, 2);
    parsed = res.parsed;
    llmResult = res.llmResult;
  } catch (err: any) {
    // Persist failure AIContentLog outside transaction
    try {
      const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
      const raw = String(err?.message ?? 'llm_failed');
      const code = inferFailureCodeFromMessage(raw);
      const le = formatLastError(code, raw);
      await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId: job.id }, responseBody: null } });
      try { await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } }); } catch {}
    } catch {
      try { await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: String(err?.message ?? 'llm_failed'), requestBody: { jobId: job.id }, responseBody: null } }); } catch {}
      try { await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: String(err?.message ?? 'llm_failed') } }); } catch {}
    }
    logger.error('handleNotesJob: LLM parse failed, marking job failed', { jobId, error: err?.message || String(err) });
    return;
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

  // Strict validation: may throw typed errors. On failure we must fail the HydrationJob and persist AIContentLog, then rethrow.
  try {
    validateOrThrow(parsed, { jobType: 'notes', language, subject: subjectName, topic: topic.name, grade, difficulty: job.difficulty });
    // Log a validation-passed event for observability
    try {
      const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linkedExec) {
        await prisma.jobExecutionLog.create({ data: { jobId: linkedExec.id, event: 'VALIDATION_PASSED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: job.id } } }).catch(() => {});
      }
    } catch { /* non-fatal */ }
  } catch (vErr: any) {
    // Failure contract: mark HydrationJob failed, persist AIContentLog, emit jobExecutionLog, then rethrow
    const reason = vErr?.type || vErr?.message || 'validation_failed'
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.VALIDATION_FAILED, String(reason));
    try {
      await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    } catch {}
    try {
      const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linkedExec) {
        await prisma.jobExecutionLog.create({ data: { jobId: linkedExec.id, event: 'VALIDATION_FAILED', prevStatus: linkedExec.status, newStatus: linkedExec.status, message: le, meta: { hydrationJobId: job.id, error: vErr?.details || null } } }).catch(() => {});
      }
    } catch {}
    try {
      await prisma.aIContentLog.create({ data: { model: 'llm', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId: job.id }, responseBody: parsed } });
    } catch {}
    throw vErr;
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
      // Idempotent write: upsert by topicId+language+version (unique)
      // Store the full LLM response (notes, worked_examples, key_terms, etc.) as contentJson
      const contentJson = { ...parsed, sourceJobId: job.id };
      await tx.topicNote.upsert({
        where: { topicId_language_version: { topicId, language, version } },
        update: {
          title: parsed.title,
          contentJson,
          source: 'ai',
          status: ApprovalStatus.Draft
        },
        create: {
          topicId,
          language,
          version,
          title: parsed.title,
          contentJson,
          source: 'ai',
          status: ApprovalStatus.Draft
        }
      });

      // Persist AIContentLog inside the transaction (success path)
      try {
        await tx.aIContentLog.create({ data: {
          model: llmResult?.model || 'llm',
          promptType: 'notes',
          board,
          grade,
          subject: subjectName,
          chapter: topic.chapter?.name || null,
          topic: topic.name,
          language: job.language || 'en',
          ...(topicId ? { topicRef: { connect: { id: topicId } } } : {}),
          tokensIn: llmResult?.usage?.prompt_tokens ?? null,
          tokensOut: llmResult?.usage?.completion_tokens ?? null,
          tokensUsed: llmResult?.usage?.total_tokens ?? null,
          costUsd: llmResult?.costUsd ?? null,
          success: true,
          status: 'success',
          requestBody: { prompt },
          responseBody: { raw: llmResult?.content }
        } });
      } catch (e) {
        throw e;
      }

      // Mark hydration job completed (workers only update their own HydrationJob)
      await tx.hydrationJob.update({
        where: { id: job.id },
        data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true }
      });

      // Emit JobExecutionLog entries for observability but DO NOT mutate ExecutionJob
      const linked = await tx.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linked) {
        const prevStatus = linked.status ?? null;
        await tx.jobExecutionLog.create({ data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: prevStatus, meta: { hydrationJobId: job.id, sourceJobId: job.id } } });
      }
    });
    logger.info('handleNotesJob: completed successfully', { jobId, topicId });
  } catch (err: any) {
    // Failure path: persist failure AIContentLog outside transaction, then mark hydration job failed
    try {
      await prisma.aIContentLog.create({ data: { model: llmResult?.model || 'llm', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: String(err.message || err), requestBody: { prompt }, responseBody: { raw: llmResult?.content } } });
    } catch {}
    try {
      const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
      const code = inferFailureCodeFromMessage(String(err?.message ?? ''));
      const le = formatLastError(code, String(err?.message ?? err));
      await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le, attempts: { increment: 0 } } });
    } catch {
      await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: String(err?.message ?? err), attempts: { increment: 0 } } });
    }
    throw err;
  }
}

export default handleNotesJob;
