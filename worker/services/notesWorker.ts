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
import { validateOrThrow, SchemaInvalidError, PlaceholderContentError } from '@/lib/aiOutputValidator';
import _fs from 'fs';
import _path from 'path';
import { renderTemplate } from '@/prompts/index'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js';
import { logger } from '@/lib/logger.js';
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types';
import { getNextVersion } from '@/lib/getNextVersion';

// If true, write raw LLM output only to worker logs (via logger) and DO NOT persist
// the raw text to `AIContentLog.responseBody.raw`. This is useful for transient
// debugging on VPS without storing potentially sensitive raw outputs.
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
  } catch (e) {
    // Never crash the worker for logging
  }
}

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

  // Check global pause -- use Paused status so the resume route can find and re-enqueue this job
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Paused, lockedAt: null } });
    logger.info('handleNotesJob: hydration paused, setting job to paused', { jobId });
    return;
  }

  // hierarchyLevel guard: notes jobs are Level 2 (reconciler-created) or Level 0 (manually enqueued).
  // null/undefined = unset (legacy or test stub) -- allowed. Any other level is a routing bug.
  if (job.hierarchyLevel != null && job.hierarchyLevel !== 0 && job.hierarchyLevel !== 2) {
    logger.error('handleNotesJob: wrong hierarchyLevel -- refusing to process', {
      jobId, hierarchyLevel: job.hierarchyLevel,
    });
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'wrong_hierarchy_level' } });
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

  // Versioning: when approved notes already exist for this topic+language, we still generate and persist
  // as a new version (don't skip). getNextVersion() returns the next version number (1, 2, 3, ...).
  const existingApproved = await prisma.topicNote.findFirst({
    where: { topicId, language: job.language, status: 'approved' }
  });
  if (existingApproved) {
    logger.info('handleNotesJob: existing approved notes found -- generating new version', { jobId, topicId });
  }

  const board = topic.chapter.subject.class.board.name;
  const grade = topic.chapter.subject.class.grade;
  const subjectName = topic.chapter.subject.name;
  const language = job.language || 'en';
  const difficultyLevel: 'foundation' | 'standard' | 'advanced' = grade <= 8 ? 'foundation' : grade <= 10 ? 'standard' : 'advanced'

  // Query sibling topics with lower order to build priorTopics list
  const priorTopics: string[] = []
  try {
    const siblings = await prisma.topicDef.findMany({
      where: {
        chapterId: (topic as any).chapterId,
        order: { lt: (topic as any).order ?? 0 },
      },
      select: { name: true },
      orderBy: { order: 'asc' },
      take: 5,
    })
    priorTopics.push(...siblings.map((s) => s.name))
  } catch { /* non-fatal -- priorTopics will be empty */ }

  // ── Ground notes in NCERT CurriculumChunk content when available ─────────────
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
        ncertContext = chunks.map((c) => c.content ?? '').filter(Boolean).join('\n\n---\n\n')
        logger.info('[notesWorker] grounding notes with NCERT chunks', {
          event: 'ncert_grounding',
          context: { jobId: job.id, chapterOrder, subject: subjectSlug, grade, chunkCount: chunks.length },
        })
      } else {
        logger.warn('[notesWorker] no NCERT chunks for chapter -- using GPT knowledge', {
          event: 'ncert_grounding_fallback',
          context: { jobId: job.id, chapterOrder, subject: subjectSlug, grade },
        })
      }
    }
  } catch (chunkErr) {
    logger.warn('[notesWorker] CurriculumChunk query failed -- using GPT knowledge', {
      event: 'ncert_grounding_error',
      context: { jobId: job.id, error: String(chunkErr) },
    })
  }

  // Use centralized prompt renderer to produce deterministic prompt and schema fingerprint
  const rendered = renderTemplate('topic-notes', {
    topicName: topic.name,
    grade,
    board,
    subject: subjectName,
    chapter: topic.chapter?.name ?? '',
    priorTopics,
    difficultyLevel,
    language: (language === 'hi' ? 'hi-en' : 'en') as any,
    ncertContext,
  });
  const prompt = rendered.prompt

  // Always use next version number so new jobs create v1, v2, v3... (versioned content, never overwrite).
  const version = await getNextVersion({ topicId, language, type: 'note' });

  // Persist initial AIContentLog with schemaHash and version for observability before calling LLM
  try {
    await prisma.aIContentLog.create({ data: {
      model: 'pending',
      promptType: 'notes',
      board,
      grade,
      subject: subjectName,
      chapter: topic.chapter?.name || null,
      topic: topic.name,
      language,
      success: false,
      status: 'started',
      requestBody: { jobId: job.id, renderer: { schemaHash: rendered.schemaHash, version: rendered.version } },
      responseBody: null
    } });
  } catch {}

  // Call LLM and attempt to parse JSON with retries/extraction heuristics
  let parsed: any;
  let llmResult: any = null;
  const llmMeta = { promptType: 'notes', board, grade, subject: subjectName, topic: topic.name, language, schemaHash: rendered.schemaHash, promptVersion: rendered.version };
  try {
    const res = await callAndParseJSON(prompt, llmMeta, 2);
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
    // Decide whether this validation failure is a retryable semantic weakness.
    // Treat explicit semantic weakness types as-is, and map certain SchemaInvalid or Placeholder errors
    // into retryable weakness categories so we can attempt the one-time quality retry.
    const SEMANTIC_WEAKNESS_TYPES = ['notes_too_short', 'notes_missing_required_section', 'notes_too_few_examples', 'notes_missing_bridge']
    let isSemanticWeakness = SEMANTIC_WEAKNESS_TYPES.some(t => vErr?.type === t || String(vErr?.message ?? '').includes(t))
    let weaknessType: string | undefined = vErr?.type || undefined

    // Map SchemaInvalid (Zod) details to semantic weakness where appropriate
    try {
      if (!isSemanticWeakness && (vErr instanceof SchemaInvalidError || String(vErr?.type) === 'SCHEMA_INVALID')) {
        const details = vErr?.details
        if (Array.isArray(details)) {
          for (const d of details) {
            const pathArr = Array.isArray(d.path) ? d.path : [d.path]
            const pathStr = pathArr.filter(Boolean).join('.')
            const msg = String(d.message || '')
            if (pathStr.includes('bridgeToNext') || /bridgeToNext/i.test(msg)) { isSemanticWeakness = true; weaknessType = 'notes_missing_bridge'; break }
            if (pathStr.includes('sections') || /sections/i.test(pathStr) || /section/i.test(msg)) { isSemanticWeakness = true; weaknessType = 'notes_missing_required_section'; break }
            if (/length|too short|min/i.test(msg) || pathStr.includes('content')) { isSemanticWeakness = true; weaknessType = 'notes_too_short'; break }
          }
        } else {
          // generic schema invalid -> treat as retryable once
          isSemanticWeakness = true; weaknessType = 'schema_invalid_generic'
        }
      }
    } catch (mapErr) {
      // ignore mapping errors
    }

    // Placeholder content should be retried once with a strict 'no placeholder' hint
    if (!isSemanticWeakness && (vErr instanceof PlaceholderContentError || String(vErr?.type) === 'PLACEHOLDER_CONTENT')) {
      isSemanticWeakness = true; weaknessType = 'placeholder_content'
    }

    if (isSemanticWeakness) {
      const weaknessDetail = vErr?.details ? JSON.stringify(vErr.details) : ''
      try {
        logger.warn('[notesWorker] semantic weakness on first attempt -- retrying LLM with quality hint', { jobId: job.id, weaknessType });
        const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response failed quality validation (${weaknessType}${weaknessDetail ? ': ' + weaknessDetail : ''}). Requirements: minimum 7 sections including hook/concept/worked_example/summary; at least 2 worked_example sections; every section content minimum 80 words; bridgeToNext sentence required. Do NOT use placeholders such as 'TBD', 'placeholder', 'content coming soon', or [insert ...].`
        const retryRes = await callAndParseJSON(retryPrompt, { ...llmMeta, retry: 1 }, 1);
        validateOrThrow(retryRes.parsed, { jobType: 'notes', language, subject: subjectName, topic: topic.name, grade, difficulty: job.difficulty });
        parsed = retryRes.parsed;
        llmResult = retryRes.llmResult;
        // Retry succeeded -- fall through to persist
      } catch (retryErr: any) {
        // Both attempts failed -- apply failure contract below
        const retryReason = retryErr?.type || retryErr?.message || 'validation_failed'
        const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
        const le = formatLastError(FailureCode.VALIDATION_FAILED, String(retryReason));
        try { await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } }); } catch {}
        try {
          // Optionally log raw output to worker logs for debugging when flag enabled
          logRawToConsole(job.id, llmResult);
          const responseBody = getResponseBodyForDb(parsed, llmResult);
          await prisma.aIContentLog.create({ data: { model: 'llm', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId: job.id }, responseBody } });
        } catch {}
        throw retryErr;
      }
    } else {
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
        // Optionally log raw output to worker logs for debugging when flag enabled
        logRawToConsole(job.id, llmResult);
        const responseBody = getResponseBodyForDb(parsed, llmResult);
        await prisma.aIContentLog.create({ data: { model: 'llm', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId: job.id }, responseBody } });
      } catch {}
      throw vErr;
    }
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
          title: (parsed.metadata?.topic ?? parsed.title) as string,
          contentJson,
          source: 'ai',
          status: ApprovalStatus.Draft
        },
        create: {
          topicId,
          language,
          version,
          title: (parsed.metadata?.topic ?? parsed.title) as string,
          contentJson,
          source: 'ai',
          status: ApprovalStatus.Draft
        }
      });

      // Persist AIContentLog inside the transaction (success path)
      try {
        const successResponseBody = getResponseBodyForDb(parsed, llmResult);
        // Log raw if console-only mode enabled
        logRawToConsole(job.id, llmResult);
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
          responseBody: successResponseBody
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
      // Optionally log raw output to worker logs for debugging when flag enabled
      logRawToConsole(job.id, llmResult);
      const responseBody = getResponseBodyForDb(parsed, llmResult);
      await prisma.aIContentLog.create({ data: { model: llmResult?.model || 'llm', promptType: 'notes', language: job.language || 'en', success: false, status: 'failed', error: String(err.message || err), requestBody: { prompt }, responseBody } });
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
