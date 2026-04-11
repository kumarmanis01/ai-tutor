import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { InMemoryRateLimiter } from '@/lib/alerts/rateLimiter'
import { hasConsented, ConsentScope } from '@/lib/consent/check'
import {
  enforceTutorFreemiumCap,
  getTutorSession,
  requireTutorEnabled,
  runTutorOrchestrator,
  setTutorSession,
  type TutorSessionState,
  type TutorTurnError,
  type TutorTurnRequest,
} from '@/services/tutor/turn'

export const dynamic = 'force-dynamic'

const limiter = new InMemoryRateLimiter(10, 0.5) // 10 tokens capacity, 0.5/sec refill

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx: disable response buffering for SSE
    'X-Accel-Buffering': 'no',
  }
}

function toSseEvent(event: 'token' | 'complete' | 'error', data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function errorPayload(code: TutorTurnError['code'], message: string, retryable: boolean): TutorTurnError {
  return { code, message, retryable }
}

function chunkText(text: string, chunkSize = 48): string[] {
  const s = String(text ?? '')
  if (!s) return []
  const out: string[] = []
  for (let i = 0; i < s.length; i += chunkSize) out.push(s.slice(i, i + chunkSize))
  return out
}

export type TutorTurnRequest = {
  sessionId: string
  studentMessage: string
  turnNumber: number
  conceptId: string
  subjectId: string
  isCorrect?: boolean
  questionId?: string
  itemDifficulty?: number
}

function parseBody(body: any): TutorTurnRequest | null {
  if (!body || typeof body !== 'object') return null
  const sessionId = body.sessionId
  const studentMessage = body.studentMessage
  const turnNumber = body.turnNumber
  const conceptId = body.conceptId
  const subjectId = body.subjectId
  const isCorrect = body.isCorrect
  const questionId = body.questionId
  const itemDifficulty = body.itemDifficulty

  if (typeof sessionId !== 'string' || !sessionId.trim()) return null
  if (typeof studentMessage !== 'string') return null
  const msg = studentMessage.trim()
  if (!msg || msg.length > 2000) return null
  if (typeof turnNumber !== 'number' || !Number.isFinite(turnNumber) || turnNumber < 0) return null
  if (typeof conceptId !== 'string' || !conceptId.trim()) return null
  if (typeof subjectId !== 'string' || !subjectId.trim()) return null

  const parsed: TutorTurnRequest = {
    sessionId: sessionId.trim(),
    studentMessage: msg,
    turnNumber: Math.floor(turnNumber),
    conceptId: conceptId.trim(),
    subjectId: subjectId.trim(),
  }

  if (typeof isCorrect === 'boolean') parsed.isCorrect = isCorrect
  if (typeof questionId === 'string' && questionId.trim()) parsed.questionId = questionId.trim()
  if (typeof itemDifficulty === 'number' && Number.isFinite(itemDifficulty)) parsed.itemDifficulty = itemDifficulty

  return parsed
}

async function streamSingleError(status: number, payload: TutorTurnError) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(toSseEvent('error', payload)))
      controller.close()
    },
  })
  return new Response(stream, { status, headers: sseHeaders() })
}

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const authSession = await getServerSessionForHandlers()
    const userId = (authSession as any)?.user?.id as string | undefined
    if (!userId) {
      const res = await streamSingleError(401, errorPayload('FEATURE_DISABLED', 'Unauthorized', false))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    const allowed = await limiter.allow(`tutor_turn:${userId}`, 1)
    if (!allowed) {
      const res = await streamSingleError(429, errorPayload('RATE_LIMITED', 'Rate limited. Please wait a moment and try again.', true))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    const bodyRaw = await req.json().catch((e) => { logger.warn('Failed to parse request JSON', { className: 'TutorTurnAPI', methodName: 'POST', error: e }); return null })
    const parsed = parseBody(bodyRaw)
    if (!parsed) {
      const res = await streamSingleError(400, errorPayload('SESSION_NOT_FOUND', 'Invalid request body.', false))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    // Consent gate (DPDP T37) -- must have AI_INTERACTION consent
    const canUseAI = await hasConsented(userId, ConsentScope.AI_INTERACTION)
    if (!canUseAI) {
      const res = await streamSingleError(403, errorPayload('CONSENT_REQUIRED', 'AI interaction consent required', false))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    // Auth check → feature flag check → freemium cap check → load Redis state → orchestrator → SSE stream
    try {
      await requireTutorEnabled(userId)
    } catch {
      const res = await streamSingleError(403, errorPayload('FEATURE_DISABLED', 'AI Tutor is not enabled for your account.', false))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    try {
      await enforceTutorFreemiumCap(userId)
    } catch (e: any) {
      const code = String(e?.code ?? '')
      if (code === 'RATE_LIMITED') {
        const res = await streamSingleError(403, errorPayload('RATE_LIMITED', 'Free limit reached. Please upgrade to continue.', false))
        logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
        return res
      }
      const res = await streamSingleError(503, errorPayload('AI_UNAVAILABLE', 'AI Tutor is temporarily unavailable.', true))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    const existing = await getTutorSession(parsed.sessionId)
    const state: TutorSessionState =
      existing ??
      ({
        sessionId: parsed.sessionId,
        stage: 'HOOK',
        hintsRemaining: 3,
        lastTurnNumber: 0,
        consecutiveWrongAnswers: 0,
        stageAttemptCount: 0,
        prereqRemediationActive: false,
        prereqReturnStage: null,
      } satisfies TutorSessionState)

    // Validate client-tracked turnNumber server-side (monotonic)
    if (parsed.turnNumber < state.lastTurnNumber) {
      const res = await streamSingleError(409, errorPayload('SESSION_NOT_FOUND', 'Stale turn number.', true))
      logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
      return res
    }

    // Set lastTurnNumber immediately to help reconnect flows (best-effort)
    const nextState: TutorSessionState = { ...state, lastTurnNumber: parsed.turnNumber }
    await setTutorSession(nextState).catch((e) => { logger.warn('setTutorSession failed', { className: 'TutorTurnAPI', methodName: 'POST', error: e }) })

    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // AC-04: first AI message must appear within 5 s of session start.
          // Capture orchestrator latency so slow LLM calls surface in logs.
          const orchestratorStart = Date.now()
          const { answerText, complete } = await runTutorOrchestrator({
            studentId: userId,
            state: nextState,
            studentMessage: parsed.studentMessage,
            conceptId: parsed.conceptId,
            subjectId: parsed.subjectId,
            isCorrect: parsed.isCorrect,
            questionId: parsed.questionId,
            itemDifficulty: parsed.itemDifficulty,
          })
          const orchestratorMs = Date.now() - orchestratorStart
          if (orchestratorMs > 5000) {
            logger.warn('TutorTurnAPI: slow first token', {
              event: 'tutor_turn_slow_first_token',
              context: { userId, orchestratorMs, thresholdMs: 5000 },
            })
          }

          for (const chunk of chunkText(answerText)) {
            controller.enqueue(encoder.encode(toSseEvent('token', { chunk })))
          }

          controller.enqueue(encoder.encode(toSseEvent('complete', complete)))
          controller.close()
        } catch (err: any) {
          const code = String(err?.code ?? '')
          const payload =
            code === 'AI_UNAVAILABLE'
              ? errorPayload('AI_UNAVAILABLE', 'AI Tutor is temporarily unavailable.', true)
              : code === 'FEATURE_DISABLED'
                ? errorPayload('FEATURE_DISABLED', 'AI Tutor is not enabled for your account.', false)
                : errorPayload('AI_UNAVAILABLE', 'AI Tutor failed to respond.', true)
          controller.enqueue(encoder.encode(toSseEvent('error', payload)))
          controller.close()
        }
      },
    })

    const res = new Response(stream, { status: 200, headers: sseHeaders() })
    logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 })
    logger.logAPI(req, res, { className: 'TutorTurnAPI', methodName: 'POST' }, start)
    return res
  }
}

