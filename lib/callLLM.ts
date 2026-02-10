import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { normalizeLanguage } from '@/lib/normalize'
import { logger } from '@/lib/logger'

/**
 * Build a minimal retrieval context suitable for RAG-lite usage.
 * Only includes high-level syllabus metadata and sibling topic names.
 * Never include full textbook content.
 */
async function prepareRetrievalContext(meta: any, charLimit = 2000) {
  try {
    if (!meta) return ''
    // If topicId provided, load topic and chapter info
    if (meta.topicId) {
      const t = await prisma.topicDef.findUnique({ where: { id: meta.topicId }, include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } } })
      if (!t) return ''
      const board = t.chapter?.subject?.class?.board?.name || ''
      const grade = t.chapter?.subject?.class?.grade || ''
      const subject = t.chapter?.subject?.name || ''
      const chapter = t.chapter?.name || ''
      // sibling topics
      const siblings = await prisma.topicDef.findMany({ where: { chapterId: t.chapterId }, select: { name: true }, take: 20 })
      const topicNames = siblings.map(s => s.name).join(', ')
      const parts: string[] = []
      if (board) parts.push(`Board: ${board}`)
      if (grade) parts.push(`Grade: ${grade}`)
      if (subject) parts.push(`Subject: ${subject}`)
      if (chapter) parts.push(`Chapter: ${chapter}`)
      if (topicNames) parts.push(`Sibling topics: ${topicNames}`)
      const ctx = parts.join('\n')
      return ctx.length > charLimit ? ctx.slice(0, charLimit) : ctx
    }
    return ''
  } catch (e) {
    logger.warn('prepareRetrievalContext failed', { error: String(e) })
    return ''
  }
}

// Safety: only allow calling LLMs from worker processes. Workers must set
// `ALLOW_LLM_CALLS=1` in their environment (see worker/bootstrap.ts).
function ensureWorkerAllowed() {
  if (process.env.ALLOW_LLM_CALLS !== '1') {
    throw new Error('LLM calls are restricted to worker processes. Set ALLOW_LLM_CALLS=1 in worker runtime.')
  }
}

let client: any = null
function getClient() {
  if (!client) {
    ensureWorkerAllowed()
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function createChatCompletion(input: any) {
  const c = getClient()
  return c.chat.completions.create(input)
}

export async function createSpeech(input: any) {
  const c = getClient()
  return c.audio.speech.create(input)
}

export async function callLLM({ prompt, model, meta, timeoutMs }: { prompt: string; model?: string; meta: any; timeoutMs?: number }) {
  ensureWorkerAllowed()
  const client = getClient()
  const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

  // Model selection rules
  // - Small models for topics/structure/syllabus
  // - Medium models for notes, doubts (chat), practice questions
  // - Large models for complex question generation only
  // - Never use large models for orchestration/pipeline logic
  const promptType = meta?.promptType || 'general'
  const envSmall = process.env.MODEL_SMALL || 'gpt-4o-mini'
  const envMedium = process.env.MODEL_MEDIUM || 'gpt-4o'
  const envLarge = process.env.MODEL_LARGE || 'gpt-4o'
  const envDefault = process.env.MODEL_DEFAULT || envSmall

  const selectedModel = model || ((): string => {
    if (['topics', 'structure', 'syllabus'].includes(promptType)) return envSmall
    if (['notes', 'doubts', 'practice'].includes(promptType)) return envMedium
    if (['questions'].includes(promptType)) return envLarge
    return envDefault
  })()

  // Forbid using large models for orchestration logic
  if (['orchestration', 'workflow', 'reconciler'].includes(promptType) && selectedModel === envLarge) {
    throw new Error('forbidden_model_for_orchestration')
  }

  // Optionally prepend a small RAG-lite context (board/chapter/topic names)
  if (meta?.useRag === true) {
    const charLimit = Number(process.env.RAG_CONTEXT_CHAR_LIMIT || 2000)
    const ctx = await prepareRetrievalContext(meta, charLimit)
    if (ctx && ctx.length > 0) {
      // Deterministic prefix formatting
      prompt = `CONTEXT:\n${ctx}\n\nINSTRUCTIONS:\n${prompt}`
    }
  }

  // Prompt size guard - prefer failing fast if context too large
  const MAX_PROMPT_LENGTH = Number(process.env.MAX_PROMPT_LENGTH || 24_000) // characters
  if ((prompt || '').length > MAX_PROMPT_LENGTH) {
    throw new Error('prompt_too_large')
  }

  const WORKER_DEBUG = process.env.WORKER_DEBUG === '1'

  const start = Date.now()
  const effectiveTimeout = timeoutMs ?? Number(process.env.LLM_CALL_TIMEOUT_MS || 20_000)

  try {
    // Promise.race to enforce timeout (note: underlying request not aborted)
    const response: any = await Promise.race([
      client.chat.completions.create({ model: selectedModel, messages: [{ role: 'user', content: prompt }], temperature: 0.0 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('llm_timeout')), effectiveTimeout))
    ])

    const latencyMs = Date.now() - start
    const usage = response.usage
    const content = response.choices?.[0]?.message?.content ?? ''

    if (HYDRATION_DEBUG) {
      try {
        logger.debug('[ai][DEBUG] callLLM prompt length', { promptLength: (prompt || '').length })
        logger.debug('[ai][DEBUG] callLLM response length', { responseLength: (content || '').length })
        logger.info('callLLM debug', { promptLength: (prompt || '').length, responseLength: (content || '').length, meta, model: selectedModel, latencyMs })
      } catch {}
    }

    const AI_CONTENT_DEBUG = process.env.AI_CONTENT_DEBUG === '1'
    if (AI_CONTENT_DEBUG) {
      try { logger.info('AI_CONTENT_DEBUG: raw LLM content', { rawContent: content, meta }) } catch {}
    }

    if (WORKER_DEBUG) {
      try {
        let parsed: any = null
        try { parsed = JSON.parse(content) } catch {}
        logger.info('WORKER_DEBUG: LLM response (raw + parsed)', { raw: content, parsed, meta })
      } catch (e) { logger.warn('WORKER_DEBUG: failed to log LLM response', { error: String(e) }) }
    }

    const costUsd = ((usage?.prompt_tokens || 0) * 0.00000015) + ((usage?.completion_tokens || 0) * 0.0000006)

    try {
      const respBody: any = JSON.parse(JSON.stringify(response));
      if (AI_CONTENT_DEBUG) respBody._rawText = content;

      // Allow callers to suppress auto-logging and instead persist AIContentLog inside their transaction
      const suppressLog = !!meta?.suppressLog;
      if (!suppressLog) {
        await prisma.aIContentLog.create({
          data: {
            model: selectedModel,
            promptType: promptType,
            board: meta?.board,
            grade: meta?.grade,
            subject: meta?.subject,
            chapter: meta?.chapter,
            topic: meta?.topic,
            language: normalizeLanguage(meta?.language),
            topicId: meta?.topicId,
            hydrationJobId: meta?.hydrationJobId || meta?.jobId || null,
            tokensIn: usage?.prompt_tokens,
            tokensOut: usage?.completion_tokens,
            tokensUsed: usage?.total_tokens,
            costUsd,
            latencyMs,
            success: true,
            status: 'success',
            requestBody: { prompt },
            responseBody: respBody,
          },
        })
      }
      // Attach model to result for callers to persist in-transaction if they suppressed logging
      return { content, usage, costUsd, latencyMs, model: selectedModel }
    } catch (e) { logger.error('Failed to write AIContentLog', { error: String(e) }) }

    return { content, usage, costUsd, latencyMs, model: selectedModel }
  } catch (error: any) {
    const latencyMs = Date.now() - start
    try {
      // Persist failure logs outside caller transactions unless caller opted to handle logging
      if (!meta?.suppressLog) {
        await prisma.aIContentLog.create({ data: {
          model: selectedModel,
          promptType: promptType,
          board: meta?.board,
          grade: meta?.grade,
          subject: meta?.subject,
          chapter: meta?.chapter,
          topic: meta?.topic,
          language: normalizeLanguage(meta?.language),
          topicId: meta?.topicId,
          hydrationJobId: meta?.hydrationJobId || meta?.jobId || null,
          success: false,
          status: 'failed',
          error: error?.message ?? String(error),
          latencyMs
        } })
      }
    } catch (e) { logger.error('Failed to write AIContentLog on error path', { error: String(e) }) }
    throw error
  }
}

/**
 * Basic batching helper: execute multiple LLM calls in parallel when safe.
 * Ensures all calls use the same model and promptType to allow batching and reduced overhead.
 */
export async function batchCallLLM(calls: Array<{ prompt: string; meta: any }>, opts?: { model?: string; timeoutMs?: number }) {
  if (!calls || calls.length === 0) return []
  // Ensure batch safety: all calls must share the same promptType and intended model
  const model = opts?.model
  const promptTypes = Array.from(new Set(calls.map(c => c.meta?.promptType || 'general')))
  if (promptTypes.length > 1) throw new Error('batch_mixed_promptTypes')
  const promptType = promptTypes[0]
  // If model not provided, pick via same selection rules as callLLM
  const resolvedModel = model || ((): string => {
    if (['topics', 'structure', 'syllabus'].includes(promptType)) return process.env.MODEL_SMALL || 'gpt-4o-mini'
    if (['notes', 'doubts', 'practice'].includes(promptType)) return process.env.MODEL_MEDIUM || 'gpt-4o'
    if (['questions'].includes(promptType)) return process.env.MODEL_LARGE || 'gpt-4o'
    return process.env.MODEL_DEFAULT || (process.env.MODEL_SMALL || 'gpt-4o-mini')
  })()
  // Enforce no-large-for-orchestration
  if (['orchestration', 'workflow', 'reconciler'].includes(promptType) && resolvedModel === (process.env.MODEL_LARGE || 'gpt-4o')) {
    throw new Error('forbidden_model_for_orchestration')
  }
  const timeoutMs = opts?.timeoutMs
  // Parallelize but limit concurrency
  const concurrency = Number(process.env.LLM_BATCH_CONCURRENCY || 4)
  const results: any[] = []
  const queue = calls.slice()
  const workers: Promise<void>[] = []
  const runOne = async (c: any) => {
    const res = await callLLM({ prompt: c.prompt, model: resolvedModel, meta: c.meta, timeoutMs })
    results.push({ meta: c.meta, res })
  }
  for (let i = 0; i < concurrency; i++) {
    workers.push((async function workerLoop() {
      while (queue.length) {
        const item = queue.shift()
        if (!item) break
        await runOne(item)
      }
    })())
  }
  await Promise.all(workers)
  return results
}
