import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { normalizeLanguage } from '@/lib/normalize'
import { logger } from '@/lib/logger'

export type TutorCallType = 'tutor:teach' | 'tutor:hint' | 'tutor:eval'

export class LLMError extends Error {
  constructor(
    public code: 'AI_UNAVAILABLE' | 'RATE_LIMITED' | 'CONTEXT_TOO_LONG',
    message: string
  ) {
    super(message)
  }
}

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
  // Allow mock mode anywhere for fast dev/hydration testing
  if (process.env.LLM_MODE === 'mock') return
  if (process.env.ALLOW_LLM_CALLS !== '1') {
    throw new Error('LLM calls are restricted to worker processes. Set ALLOW_LLM_CALLS=1 in worker runtime.')
  }
}

let client: any = null
function getClient() {
  if (process.env.LLM_MODE === 'mock') {
    // Return a minimal dummy client shape used by callers, but real calls are short-circuited.
    return {
      chat: { completions: { create: async () => ({ choices: [{ message: { content: '{}' } }], usage: {} }) } },
      audio: { speech: { create: async () => ({}) } }
    }
  }
  if (!client) {
    ensureWorkerAllowed()
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function createChatCompletion(input: any) {
  if (process.env.LLM_MODE === 'mock') {
    return { choices: [{ message: { content: JSON.stringify({ mock: true, input }) } }], usage: {} }
  }
  const c = getClient()
  return c.chat.completions.create(input)
}

export async function createSpeech(input: any) {
  if (process.env.LLM_MODE === 'mock') {
    return { mock: true }
  }
  const c = getClient()
  return c.audio.speech.create(input)
}

type CallLLMArgs = { prompt: string; model?: string; meta: any; timeoutMs?: number };

function isRetryableLLMError(err: any): boolean {
  if (err instanceof LLMError) {
    return err.code === 'AI_UNAVAILABLE' || err.code === 'RATE_LIMITED'
  }
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  if (!msg) return false;
  if (msg.includes('llm_timeout')) return true;
  if (msg.includes('timeout')) return true;
  if (msg.includes('etimedout')) return true;
  if (msg.includes('econnreset')) return true;
  if (msg.includes('rate limit') || msg.includes('rate_limit')) return true;
  if (msg.includes('temporarily unavailable') || msg.includes('try again')) return true;
  return false;
}

export async function callLLM({ prompt, model, meta, timeoutMs }: CallLLMArgs) {
  // Fast dev: return deterministic mock response when enabled before any DB/HTTP calls
  if (process.env.LLM_MODE === 'mock') {
    const topic = meta?.topic || meta?.topicName || (prompt && prompt.slice(0, 40)) || 'mock-topic'
    const mockObj = {
      title: topic,
      concept: `Concept of ${topic}`,
      explanation: `Explanation for ${topic}`,
      example: `Example of ${topic}`,
      keyPoints: ['Point A', 'Point B'],
      commonMistakes: ['Mistake A']
    }
    const content = JSON.stringify(mockObj)
    return { content, usage: {}, costUsd: 0, latencyMs: 0, model: 'mock' }
  }
  ensureWorkerAllowed()
  const client = getClient()
  const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

  const callType = (meta?.callType || meta?.promptType || 'general') as string
  const isTutorCall = typeof callType === 'string' && callType.startsWith('tutor:')

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
    if (callType === 'tutor:hint' || callType === 'tutor:eval') return envSmall
    if (callType === 'tutor:teach') return envMedium
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
    if (isTutorCall) throw new LLMError('CONTEXT_TOO_LONG', 'Tutor context too long')
    throw new Error('prompt_too_large')
  }

  const WORKER_DEBUG = process.env.WORKER_DEBUG === '1'

  const start = Date.now()
  const baseTimeout = timeoutMs ?? Number(process.env.LLM_CALL_TIMEOUT_MS || 45_000) // increased default
  const maxAttempts = Number(process.env.LLM_RETRY_MAX_ATTEMPTS || 3)
  const baseDelayMs = Number(process.env.LLM_RETRY_BASE_DELAY_MS || 2000)

  let attempt = 0;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const attemptStart = Date.now();
    const effectiveTimeout = baseTimeout;

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

        // Allow callers to suppress auto-logging and instead persist logs inside their transaction
        const suppressLog = !!meta?.suppressLog;
        if (!suppressLog) {
          if (isTutorCall) {
            await prisma.aITutorTurnLog.create({
              data: {
                sessionId: String(meta?.sessionId ?? ''),
                callType,
                model: selectedModel,
                inputTokens: Number(usage?.prompt_tokens ?? 0),
                outputTokens: Number(usage?.completion_tokens ?? 0),
                costUsd: Number(costUsd ?? 0),
                latencyMs: Number(latencyMs ?? 0),
                tag: meta?.tag ? String(meta.tag) : null,
                stage: meta?.stage ? String(meta.stage) : null,
                safetyFlagged: Boolean(meta?.safetyFlagged ?? false),
                cached: Boolean(meta?.cached ?? false),
                ragChunksUsed: Array.isArray(meta?.ragChunksUsed) ? meta.ragChunksUsed.map((x: any) => String(x)) : [],
                frustrationScore: typeof meta?.frustrationScore === 'number' ? meta.frustrationScore : null,
              },
            })
          } else {
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
                tokensIn: usage?.prompt_tokens,
                tokensOut: usage?.completion_tokens,
                tokensUsed: usage?.total_tokens,
                costUsd,
                success: true,
                status: 'success',
                requestBody: { prompt },
                responseBody: respBody,
              },
            })
          }
        }
        // Attach model and attempt to result for callers
        return { content, usage, costUsd, latencyMs, model: selectedModel, attempt }
      } catch (e) { logger.error('Failed to write AIContentLog', { error: String(e) }) }

      return { content, usage, costUsd, latencyMs, model: selectedModel, attempt }
    } catch (error: any) {
      lastError = error;
      const latencyMs = Date.now() - attemptStart;

      const retryable = isRetryableLLMError(error);
      const isLastAttempt = attempt >= maxAttempts;

      // Persist failure logs outside caller transactions unless caller opted to handle logging
      try {
        if (!meta?.suppressLog) {
          if (isTutorCall) {
            await prisma.aITutorTurnLog.create({
              data: {
                sessionId: String(meta?.sessionId ?? ''),
                callType,
                model: selectedModel,
                inputTokens: 0,
                outputTokens: 0,
                costUsd: 0,
                latencyMs: Number(latencyMs ?? 0),
                tag: meta?.tag ? String(meta.tag) : null,
                stage: meta?.stage ? String(meta.stage) : null,
                safetyFlagged: Boolean(meta?.safetyFlagged ?? false),
                cached: Boolean(meta?.cached ?? false),
                ragChunksUsed: Array.isArray(meta?.ragChunksUsed) ? meta.ragChunksUsed.map((x: any) => String(x)) : [],
                frustrationScore: typeof meta?.frustrationScore === 'number' ? meta.frustrationScore : null,
              },
            })
          } else {
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
              success: false,
              status: 'failed',
              error: error?.message ?? String(error),
            } })
          }
        }
      } catch (e) { logger.error('Failed to write AIContentLog on error path', { error: String(e) }) }

      if (!retryable || isLastAttempt) {
        if (isTutorCall) {
          const msg = String(error?.message ?? error ?? '')
          const lower = msg.toLowerCase()
          if (lower.includes('rate limit') || lower.includes('rate_limit')) throw new LLMError('RATE_LIMITED', msg || 'Rate limited')
          if (lower.includes('prompt_too_large') || lower.includes('context too long') || lower.includes('prompt too large')) throw new LLMError('CONTEXT_TOO_LONG', msg || 'Context too long')
          if (lower.includes('llm_timeout') || lower.includes('timeout') || lower.includes('temporarily unavailable')) throw new LLMError('AI_UNAVAILABLE', msg || 'AI unavailable')
          throw new LLMError('AI_UNAVAILABLE', msg || 'AI unavailable')
        }
        throw error
      }

      // Backoff before next attempt (exponential with cap)
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30_000);
      try {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch {
        // ignore sleep errors
      }
    }
  }

  // If we exited loop without returning, throw last error
  throw lastError ?? new Error('llm_call_failed');
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
