/**
 * FILE OBJECTIVE:
 * - Syllabus hydration worker that generates chapters and topics for a subject.
 * - Supports cascadeAll flag to auto-queue notes, questions, and tests for all topics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/syllabusWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 *
 * EDIT LOG:
 * - 2026-01-22T13:15:00Z | copilot | Fixed enqueue function calls to use single-object input pattern
 * - 2026-01-22T07:45:00Z | copilot | Added cascadeAll support for full content hydration
 */

import { prisma } from '@/lib/prisma.js'
import { callLLM } from '@/lib/callLLM.js'
import { parseLlmJson } from '@/lib/llm/sanitizeJson'
import fs from 'fs'
import path from 'path'
import { toSlug } from '@/lib/slug.js'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js'
import { logger } from '@/lib/logger.js'
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'
// Per spec, workers must not enqueue child hydration jobs; orchestrator/reconciler handles downstream job creation.

function validateSyllabusShape(raw: any) {
  if (!raw || typeof raw !== 'object') return false
  const { chapters } = raw
  if (!Array.isArray(chapters)) return false
  for (const ch of chapters) {
    if (!ch || typeof ch !== 'object') return false
    if (!ch.title || typeof ch.title !== 'string') return false
    if (ch.order !== undefined && typeof ch.order !== 'number') return false
    if (ch.topics !== undefined) {
      if (!Array.isArray(ch.topics)) return false
      for (const t of ch.topics) {
        if (!t || typeof t !== 'object') return false
        if (!t.title || typeof t.title !== 'string') return false
        if (t.order !== undefined && typeof t.order !== 'number') return false
      }
    }
  }
  return true
}

function _sanitizeLLMOutput(content: string): string {
  if (!content || typeof content !== 'string') return content
  let s = content.trim()

  // Strip triple-backtick fences and optional language tag on the opening fence
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n')
    if (firstNewline !== -1) s = s.slice(firstNewline + 1)
    // remove trailing fence if present
    const closingFence = s.lastIndexOf('```')
    if (closingFence !== -1) s = s.slice(0, closingFence)
    s = s.trim()
  }

  // Also handle content wrapped in single backticks or triple tildes
  if (s.startsWith('`') && s.endsWith('`')) s = s.slice(1, -1).trim()
  if (s.startsWith('~~~')) {
    const firstNewline = s.indexOf('\n')
    if (firstNewline !== -1) s = s.slice(firstNewline + 1)
    const closing = s.lastIndexOf('~~~')
    if (closing !== -1) s = s.slice(0, closing)
    s = s.trim()
  }

  return s
}

export async function handleSyllabusJob(jobId: string) {
  const claim = await prisma.hydrationJob.updateMany({
    where: { id: jobId, status: JobStatus.Pending },
    data: { status: JobStatus.Running, attempts: { increment: 1 }, lockedAt: new Date() }
  })
  if (claim.count === 0) return

  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
  if (!job) return

  const paused = await prisma.systemSetting.findUnique({ where: { key: "HYDRATION_PAUSED" } })
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Pending } })
    return
  }

  const subjectId = (job as any).subjectId || null
  if (!subjectId) {
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.DEPENDENCY_MISSING, 'missing_subjectId');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } })
    return
  }

  const existing = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
  if (existing) {
    // Chapters already exist — skip LLM call but keep root as Running with contentReady
    // so the reconciler can still create child notes/questions jobs for existing topics.
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Running, contentReady: true, lastError: null } })
    return
  }

  const subjectRow = await prisma.subjectDef.findUnique({ where: { id: subjectId as string } })
  const board = job.board || ''
  const grade = job.grade || 0
  const subjectName = subjectRow?.name || job.subject || ''
  const language = job.language || 'en'

  // Load a syllabus prompt template if available
  const promptsDir = path.join(process.cwd(), 'prompts')
  const templatePath = path.join(promptsDir, 'syllabus_worker_prompt.md')
  // llmResult holds the LLM response and is used below
  let llmResult: any = null
  // Ensure `prompt` is declared in outer scope so it is available later when
  // persisting AI logs or performing transactions. Previously it was declared
  // inside the try block which caused a ReferenceError when referenced below.
  let prompt = ''
  try {
    if (fs.existsSync(templatePath)) {
      prompt = fs.readFileSync(templatePath, 'utf8')
        .replace(/{{board}}/g, board)
        .replace(/{{grade}}/g, String(grade))
        .replace(/{{subject}}/g, subjectName)
        .replace(/{{language}}/g, language)
    } else {
      // fallback to inline prompt if template missing
      prompt = `You are an expert curriculum designer.\n\nGenerate an academic syllabus strictly aligned to:\nBoard: ${board}\nGrade: ${grade}\nSubject: ${subjectName}\nLanguage: ${language}\n\nRules:\n- Output JSON ONLY\n- No explanations\n- Chapters must be ordered\n- Topics must be ordered\n- Topics must be concise, age-appropriate, and non-overlapping\n- Do NOT include assessments or activities\n- Do NOT include subtopics\n- Do NOT invent extra subjects\n\nJSON Schema:\n{\n  "chapters": [\n    {\n      "title": "string",\n      "order": number,\n      "topics": [\n        { "title": "string", "order": number }\n      ]\n    }\n  ]\n}\n`
    }

    llmResult = await callLLM({
      prompt,
      meta: { promptType: 'syllabus', board, grade, subject: subjectName, language, useRag: true, hydrationJobId: job.id, suppressLog: true },
      timeoutMs: Number(process.env.SYLLABUS_LLM_TIMEOUT_MS || 20_000)
    })
  } catch (err: any) {
    const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
    const code = inferFailureCodeFromMessage(err?.message || '');
    const le = formatLastError(code, String(err?.message || 'llm_call_failed'));
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } })
    throw err
  }
  // Record that a response was received — attempt to attach to a linked ExecutionJob if present
  let linkedExec: any = null
  try {
    linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } })
    if (linkedExec) {
      await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'RESPONSE_RECEIVED', prevStatus: linkedExec.status ?? null, newStatus: linkedExec.status ?? null, meta: { hydrationJobId: job.id } } }).catch(() => {})
    }
  } catch {
    // ignore
  }

  let parsed: any
  try {
    const raw = parseLlmJson(llmResult.content)
    if (!validateSyllabusShape(raw)) throw new Error('validation_failed')
    parsed = raw
  } catch (err: any) {
    logger.error("Failed to parse LLM output in handleSyllabusJob", { jobId: job.id, error: err });
    // mark hydration job failed with parse error
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.PARSE_FAILED, 'invalid_llm_output');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } })

    // if we discovered a linked ExecutionJob, mark it failed and write a PARSE_FAILED audit entry
    if (linkedExec) {
      try {
        // Do NOT mutate ExecutionJob state from workers. Emit an audit log only.
        await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'PARSE_FAILED', prevStatus: linkedExec.status ?? null, newStatus: linkedExec.status ?? null, message: le, meta: { hydrationJobId: job.id } } }).catch(() => {});
      } catch {
        // ignore logging failures
      }
      // Persist failure AIContentLog outside transaction since we suppressed auto-logging
      try { await prisma.aIContentLog.create({ data: { model: llmResult?.model || 'none', promptType: 'syllabus', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId: job.id }, responseBody: { raw: llmResult?.content } } }) } catch {}
      throw new Error('invalid_llm_output');
    }

    // No linked execution job: return gracefully to avoid crashing the worker process
    return;
  }

  parsed.chapters.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
  for (const ch of parsed.chapters) {
    if (Array.isArray(ch.topics)) ch.topics.sort((x: any, y: any) => (x.order ?? 0) - (y.order ?? 0))
  }

  try {
    // Track created topic IDs for cascading downstream jobs
    const createdTopicIds: string[] = [];

    // Retry wrapper for transactions
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

    // To avoid long-lived interactive transactions (which can fail under certain DB poolers),
    // perform per-chapter transactions and a short final transaction for logging/completion.
    for (const ch of parsed.chapters) {
      await runTxWithRetry(async (tx) => {
        const slug = toSlug(ch.title);
        const exists = await tx.chapterDef.findFirst({ where: { subjectId: subjectId as string, slug } });
        if (exists) return;

        const chapter = await tx.chapterDef.create({
          data: {
            name: ch.title,
            slug,
            order: ch.order ?? 0,
            subjectId: subjectId as string,
            status: ApprovalStatus.Draft,
            lifecycle: 'active',
          },
        });

        if (Array.isArray(ch.topics)) {
          for (const t of ch.topics) {
            const tslug = toSlug(t.title);
            const texists = await tx.topicDef.findFirst({ where: { chapterId: chapter.id, slug: tslug } });
            if (texists) continue;

            const topic = await tx.topicDef.create({
              data: {
                name: t.title,
                slug: tslug,
                order: t.order ?? 0,
                chapterId: chapter.id,
                status: ApprovalStatus.Draft,
                lifecycle: 'active',
              },
            });
            createdTopicIds.push(topic.id);
          }
        }
      });
    }

    // Short final transaction: persist AIContentLog and mark hydration job completed.
    await runTxWithRetry(async (tx) => {
      if (typeof tx.aIContentLog?.create === 'function') {
        await tx.aIContentLog.create({ data: {
          model: llmResult?.model || 'llm',
          promptType: 'syllabus',
          board,
          grade,
          subject: subjectName,
          language: job.language || 'en',
          tokensIn: llmResult?.usage?.prompt_tokens ?? null,
          tokensOut: llmResult?.usage?.completion_tokens ?? null,
          tokensUsed: llmResult?.usage?.total_tokens ?? null,
          costUsd: llmResult?.costUsd ?? null,
          success: true,
          status: 'success',
          requestBody: { prompt },
          responseBody: { raw: llmResult?.content }
        } });
      }

      // Keep root job as Running so the reconciler can drive child levels.
      // The reconciler's finalizeRootJob() will mark it Completed when all levels are done.
      await tx.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Running, contentReady: true } });
      const linked = await tx.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linked) {
        const prevStatus = linked.status ?? null;
        await tx.jobExecutionLog.create({ data: { jobId: linked.id, event: 'SYLLABUS_READY', prevStatus, newStatus: prevStatus, meta: { hydrationJobId: job.id } } });
      }
    });

    // NOTE: Per spec, workers must NOT enqueue downstream child HydrationJobs.
    // Downstream job creation should be performed by the orchestrator/reconciler.
  } catch (err: any) {
    try {
      const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
      const code = inferFailureCodeFromMessage(String(err?.message ?? ''));
      const le = formatLastError(code, String(err?.message ?? err));
      await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    } catch {
      await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: String(err?.message ?? err) } });
    }
    return;
  }
}

export default handleSyllabusJob
