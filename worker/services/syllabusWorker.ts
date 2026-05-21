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
 * - 2026-05-19T00:00:00Z | claude  | feat: PDF-anchored path seeds ChapterDef/TopicDef from CurriculumBook before LLM fallback
 */

import { prisma } from '@/lib/prisma.js'
import { callLLM } from '@/lib/callLLM.js'
import { parseLlmJson } from '@/lib/llm/sanitizeJson'
import { renderTemplate } from '@/prompts/index'
import { createStartedAIContentLog } from '@/lib/ai/aiContentLogHelper'
import { validateOrThrow } from '@/lib/aiOutputValidator'
import { toSlug } from '@/lib/slug.js'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js'
import { logger } from '@/lib/logger.js'
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'
// Per spec, workers must not enqueue child hydration jobs; orchestrator/reconciler handles downstream job creation.

// If true, write raw LLM output only to worker logs (via logger) and DO NOT persist
// the raw text to `AIContentLog.responseBody.raw`.
const LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY = String(process.env.LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY || '').toLowerCase() === 'true';

function getResponseBodyForDb(parsed: any, llmResult: any) {
  if (LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY) {
    return parsed ? { parsed } : undefined;
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
    // Use Paused status so the resume route can find and re-enqueue this job
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Paused, lockedAt: null } })
    logger.info('[syllabusWorker] hydration paused, setting job to paused', { jobId })
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
    // Chapters already exist -- skip LLM call but keep root as Running with contentReady
    // so the reconciler can still create child notes/questions jobs for existing topics.
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Running, contentReady: true, lastError: null } })
    return
  }

  // ── PDF-ANCHORED PATH ─────────────────────────────────────────────────────
  // Check for a parsed CurriculumBook for this subject. If one exists, seed
  // ChapterDef + TopicDef directly from the PDF's BookChapter/BookTopic rows
  // instead of asking the LLM to recall the NCERT structure.
  const language = job.language || 'en'

  const parsedBook = await prisma.curriculumBook.findFirst({
    where: { subjectId: subjectId as string, language, parseStatus: 'parsed' },
    include: {
      bookChapters: {
        orderBy: { chapterNumber: 'asc' },
        include: { bookTopics: { orderBy: { topicOrder: 'asc' } } },
      },
    },
  })

  if (parsedBook && parsedBook.bookChapters.length > 0) {
    logger.info('[syllabusWorker] PDF-anchored path: seeding chapters from book', {
      event: 'pdf_anchored_syllabus',
      context: { jobId: job.id, subjectId, bookId: parsedBook.id, chapterCount: parsedBook.bookChapters.length },
    })

    try {
      // Run all chapter+topic creates atomically -- roll back the whole set if anything fails
      await prisma.$transaction(async tx => {
        for (const bookChapter of parsedBook.bookChapters) {
          const slug = toSlug(bookChapter.chapterTitle)

          const chExists = await tx.chapterDef.findFirst({
            where: { subjectId: subjectId as string, slug },
          })
          if (chExists) continue

          const chapter = await tx.chapterDef.create({
            data: {
              name: bookChapter.chapterTitle,
              slug,
              order: bookChapter.chapterNumber,
              subjectId: subjectId as string,
              status: ApprovalStatus.Draft,
              lifecycle: 'active',
              bookChapterId: bookChapter.id,
            },
          })

          for (const bookTopic of bookChapter.bookTopics) {
            const tslug = toSlug(bookTopic.topicTitle)
            const tExists = await tx.topicDef.findFirst({
              where: { chapterId: chapter.id, slug: tslug },
            })
            if (tExists) continue

            await tx.topicDef.create({
              data: {
                name: bookTopic.topicTitle,
                slug: tslug,
                order: bookTopic.topicOrder,
                chapterId: chapter.id,
                status: ApprovalStatus.Draft,
                lifecycle: 'active',
                bookTopicId: bookTopic.id,
              },
            })
          }
        }

        await tx.hydrationJob.update({
          where: { id: job.id },
          data: { status: JobStatus.Running, contentReady: true, lastError: null },
        })
      })

      logger.info('[syllabusWorker] PDF-anchored syllabus seeded', {
        event: 'pdf_anchored_syllabus_complete',
        context: { jobId: job.id, subjectId, chapters: parsedBook.bookChapters.length },
      })
      return
    } catch (pdfErr: unknown) {
      logger.error('[syllabusWorker] PDF-anchored path failed -- falling through to LLM', {
        event: 'pdf_anchored_syllabus_error',
        context: { jobId: job.id, subjectId, error: String(pdfErr) },
      })
      // Fall through to LLM path
    }
  } else {
    logger.warn('[syllabusWorker] no parsed book found -- using LLM recall', {
      event: 'ncert_grounding_fallback',
      context: { jobId: job.id, subjectId, language },
    })
  }
  // ── END PDF-ANCHORED PATH ─────────────────────────────────────────────────

  const subjectRow = await prisma.subjectDef.findUnique({ where: { id: subjectId as string } })
  const board = job.board || ''
  const grade = job.grade || 0
  const subjectName = subjectRow?.name || job.subject || ''
  // language already declared above (used by PDF-anchored path)

  // ── Ground syllabus with NCERT content if available ──────────────────────
  // CurriculumChunk stores subject as a lowercase slug (e.g. 'science').
  // Normalise subjectName the same way the scraper does.
  let ncertChapterHints: string[] | undefined
  try {
    const subjectSlug = subjectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const firstChunks = await prisma.curriculumChunk.findMany({
      where: {
        board: board.toUpperCase() || undefined,
        subject: subjectSlug,
        grade: String(grade),
        conceptIds: { hasSome: ['chunkIndex:0'] },
      },
      select: { conceptIds: true, content: true },
      orderBy: { createdAt: 'asc' },
      take: 30,
    })
    if (firstChunks.length > 0) {
      // Build ordered map: chapter number → opening text snippet (first 200 chars)
      const chapterMap = new Map<number, string>()
      for (const chunk of firstChunks) {
        const chapterTag = chunk.conceptIds.find((t: string) => t.startsWith('chapter:'))
        if (!chapterTag) continue
        const chNum = parseInt(chapterTag.split(':')[1], 10)
        if (!chapterMap.has(chNum)) {
          chapterMap.set(chNum, (chunk.content ?? '').slice(0, 200).trim())
        }
      }
      if (chapterMap.size > 0) {
        ncertChapterHints = [...chapterMap.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, hint]) => hint)
        logger.info('[syllabusWorker] grounding prompt with NCERT chunks', {
          event: 'ncert_grounding',
          context: { jobId: job.id, subject: subjectSlug, grade, chaptersFound: ncertChapterHints.length },
        })
      }
    } else {
      logger.warn('[syllabusWorker] no NCERT chunks found -- using GPT knowledge', {
        event: 'ncert_grounding_fallback',
        context: { jobId: job.id, subject: subjectSlug, grade },
      })
    }
  } catch (err: unknown) {
    // Non-fatal: fall back to GPT knowledge if chunk query fails
    logger.warn('[syllabusWorker] CurriculumChunk query error -- using GPT knowledge', {
      event: 'ncert_grounding_error',
      context: { jobId: job.id, error: String(err) },
    })
  }

  // Use prompt renderer for deterministic prompt and schemaHash
  const rendered = renderTemplate('syllabus', { board, grade, subject: subjectName, language, ncertChapterHints })
  const prompt = rendered.prompt
  // Persist initial AIContentLog with schemaHash/version before LLM call
  let aiLog: any = null
  let llmResult: any = null
  try {
    aiLog = await createStartedAIContentLog(prisma, {
      model: 'pending',
      promptType: 'syllabus',
      board,
      grade,
      subject: subjectName,
      language,
      requestBody: { jobId: job.id },
      renderer: { schemaHash: rendered.schemaHash, version: rendered.version }
    })
    // LLM call
    llmResult = await callLLM({
      prompt,
      meta: { promptType: 'syllabus', board, grade, subject: subjectName, language, schemaHash: rendered.schemaHash, promptVersion: rendered.version, useRag: true, hydrationJobId: job.id, suppressLog: true },
      timeoutMs: Number(process.env.SYLLABUS_LLM_TIMEOUT_MS || 20_000)
    })
  } catch (err: unknown) {
    const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
    const emsg = err instanceof Error ? err.message : String(err);
    const code = inferFailureCodeFromMessage(emsg || '');
    const le = formatLastError(code, String(emsg || 'llm_call_failed'));
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } })
    throw err
  }
  // Record that a response was received -- attempt to attach to a linked ExecutionJob if present
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
    // Strict Zod validation
    validateOrThrow(raw, { jobType: 'syllabus', language, grade, subject: subjectName })
    parsed = raw
  } catch (err: unknown) {
    logger.error("Failed to parse LLM output in handleSyllabusJob", { jobId: job.id, error: String(err) });
    // mark hydration job failed with parse error
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.PARSE_FAILED, 'invalid_llm_output');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } })
    // Persist failure AIContentLog
      if (aiLog?.id) {
        try {
          logRawToConsole(job.id, llmResult);
          const responseBody = getResponseBodyForDb(null, llmResult);
          await prisma.aIContentLog.update({ where: { id: aiLog.id }, data: { success: false, status: 'failed', error: le, responseBody } })
        } catch {}
      }
    // if we discovered a linked ExecutionJob, mark it failed and write a PARSE_FAILED audit entry
    if (linkedExec) {
      try {
        // Do NOT mutate ExecutionJob state from workers. Emit an audit log only.
        await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'PARSE_FAILED', prevStatus: linkedExec.status ?? null, newStatus: linkedExec.status ?? null, message: le, meta: { hydrationJobId: job.id } } }).catch(() => {});
      } catch {
        // ignore logging failures
      }
      throw new Error('invalid_llm_output');
    }
    // No linked execution job: return gracefully to avoid crashing the worker process
    return;
  }

  parsed.chapters.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
  for (const ch of parsed.chapters) {
    if (Array.isArray(ch.topics)) ch.topics.sort((x: any, y: any) => (x.order ?? 0) - (y.order ?? 0))
  }

  // ── Validation cap: limit chapters to avoid runaway generation ──
  // Priority: job inputParams > VALIDATION_CAP_CHAPTERS env > 0 (no cap)
  const jobCaps = (job.inputParams as any)?.generationLimits;
  const capChapters = jobCaps?.chaptersLimit
    ?? Number(process.env.VALIDATION_CAP_CHAPTERS || 0);
  if (capChapters > 0 && parsed.chapters.length > capChapters) {
    logger.warn('[VALIDATION_CAP] syllabusWorker: capping chapters', {
      jobId: job.id,
      llmReturnedChapters: parsed.chapters.length,
      cappedTo: capChapters,
    });
    parsed.chapters = parsed.chapters.slice(0, capChapters);
  }
  logger.info('[VALIDATION] syllabusWorker: chapterCount', {
    jobId: job.id,
    chapterCount: parsed.chapters.length,
    topicCounts: parsed.chapters.map((ch: any) => ({
      chapter: ch.title,
      topicCount: Array.isArray(ch.topics) ? ch.topics.length : 0,
    })),
  });

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
    let failedChapterCount = 0;
    for (const ch of parsed.chapters) {
      try { await runTxWithRetry(async (tx) => {
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
      }); } catch (chErr: any) {
        failedChapterCount++;
        logger.warn('[syllabusWorker] chapter transaction failed, skipping chapter', {
          jobId: job.id, chapter: ch.title, error: chErr?.message || String(chErr),
        });
      }
    }

    // Short final transaction: persist AIContentLog and mark hydration job completed.
    await runTxWithRetry(async (tx) => {
      // Update AIContentLog as success
      if (aiLog?.id) {
        const successResponseBody = getResponseBodyForDb(parsed, llmResult);
        logRawToConsole(job.id, llmResult);
        await tx.aIContentLog.update({ where: { id: aiLog.id }, data: {
          model: llmResult?.model || 'llm',
          tokensIn: llmResult?.usage?.prompt_tokens ?? null,
          tokensOut: llmResult?.usage?.completion_tokens ?? null,
          tokensUsed: llmResult?.usage?.total_tokens ?? null,
          costUsd: llmResult?.costUsd ?? null,
          success: true,
          status: 'success',
          responseBody: successResponseBody
        } })
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
