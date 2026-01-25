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
import { toSlug } from '@/lib/slug.js'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js'
import { logger } from '@/lib/logger.js'
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'
import {
  enqueueNotesHydration,
  enqueueQuestionsHydration,
  enqueueAssembleHydration,
} from '@/lib/execution-pipeline/enqueueTopicHydration.js'

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

function sanitizeLLMOutput(content: string): string {
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
    data: { status: JobStatus.Running, attempts: { increment: 1 } }
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
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'missing_subjectId' } })
    return
  }

  const existing = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
  if (existing) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, lastError: null } })
    return
  }

  const subjectRow = await prisma.subjectDef.findUnique({ where: { id: subjectId as string } })
  const board = job.board || ''
  const grade = job.grade || 0
  const subjectName = subjectRow?.name || job.subject || ''
  const language = job.language || 'en'

  const prompt = `You are an expert curriculum designer.

Generate an academic syllabus strictly aligned to:
Board: ${board}
Grade: ${grade}
Subject: ${subjectName}
Language: ${language}

Rules:
- Output JSON ONLY
- No explanations
- Chapters must be ordered
- Topics must be ordered
- Topics must be concise, age-appropriate, and non-overlapping
- Do NOT include assessments or activities
- Do NOT include subtopics
- Do NOT invent extra subjects

JSON Schema:
{
  "chapters": [
    {
      "title": "string",
      "order": number,
      "topics": [
        { "title": "string", "order": number }
      ]
    }
  ]
}
`

  let llmResponse: { content: string }
  try {
    llmResponse = await callLLM({ prompt, meta: { promptType: 'syllabus', board, grade, subject: subjectName, language } })
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } })
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
    const sanitized = sanitizeLLMOutput(llmResponse.content)
    const raw = JSON.parse(sanitized)
    if (!validateSyllabusShape(raw)) throw new Error('validation_failed')
    parsed = raw
  } catch (err: any) {
    if (typeof logger !== "undefined") {
      logger.error("Failed to parse LLM output in handleSyllabusJob", { jobId: job.id, error: err });
    }
    // mark hydration job failed with parse error
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'invalid_llm_output' } })

    // if we discovered a linked ExecutionJob, mark it failed and write a PARSE_FAILED audit entry
    if (linkedExec) {
      try {
        await prisma.executionJob.update({ where: { id: String(linkedExec.id) }, data: { status: 'failed', lastError: 'invalid_llm_output' } })
        await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'PARSE_FAILED', prevStatus: linkedExec.status ?? null, newStatus: 'failed', message: 'invalid_llm_output', meta: { hydrationJobId: job.id } } }).catch(() => {})
      } catch {
        // ignore
      }
    }

    // Throw so the caller (contentWorker) treats this as a failed run and worker-level handlers run
    throw new Error('invalid_llm_output')
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

    // Per-chapter transaction: create chapter and topics for each chapter
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

    // Final transaction: mark hydration job completed and update ExecutionJob if present
    await runTxWithRetry(async (tx) => {
      await tx.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true } });
      const linked = await tx.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linked) {
        const prevStatus = linked.status ?? null;
        await tx.executionJob.update({ where: { id: linked.id }, data: { status: 'completed', updatedAt: new Date() } });
        await tx.jobExecutionLog.create({ data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: 'completed', meta: { hydrationJobId: job.id } } });
      }
    });

    // After transaction commits, check if cascadeAll flag is set and queue downstream jobs
    // This is done outside the transaction to avoid holding locks during job enqueuing
    const linkedExec2 = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
    const payload = linkedExec2?.payload as { cascadeAll?: boolean; language?: string; difficulties?: string[] } | null;

    if (payload?.cascadeAll && createdTopicIds.length > 0) {
      const lang = payload.language || language;
      const difficulties = payload.difficulties || ['easy', 'medium', 'hard'];

      logger.info('[syllabusWorker] cascadeAll enabled, queueing downstream jobs', {
        jobId: job.id,
        topicCount: createdTopicIds.length,
        language: lang,
        difficulties,
      });

      // Queue notes, questions, and assemble (tests) for each topic
      for (const topicId of createdTopicIds) {
        try {
          await enqueueNotesHydration({ topicId, language: lang });
          logger.debug('[syllabusWorker] queued notes job', { topicId, language: lang });

          for (const diff of difficulties) {
            await enqueueQuestionsHydration({ topicId, language: lang, difficulty: diff });
            logger.debug('[syllabusWorker] queued questions job', { topicId, language: lang, difficulty: diff });
          }

          for (const diff of difficulties) {
            await enqueueAssembleHydration({ topicId, language: lang, difficulty: diff });
            logger.debug('[syllabusWorker] queued assemble job', { topicId, language: lang, difficulty: diff });
          }
        } catch (queueErr) {
          logger.warn('[syllabusWorker] failed to queue downstream job', { topicId, error: queueErr });
        }
      }

      logger.info('[syllabusWorker] cascadeAll downstream jobs queued', {
        jobId: job.id,
        topicsProcessed: createdTopicIds.length,
        notesJobs: createdTopicIds.length,
        questionsJobs: createdTopicIds.length * difficulties.length,
        assembleJobs: createdTopicIds.length * difficulties.length,
      });
    }
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } });
    return;
  }
}

export default handleSyllabusJob
