import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'
import { isAiTutorEnabledForStudent } from '@/lib/features/aiTutor'
import { createChatCompletion } from '@/lib/callLLM'
import {
  getTutorSession as getRedisTutorSession,
  setTutorSession as setRedisTutorSession,
  type RedisSessionState,
} from '@/lib/redis/tutorSession'

export type TutorTag =
  | 'QUESTION'
  | 'VALIDATE'
  | 'HINT_OFFER'
  | 'STAGE_ADVANCE'
  | 'PREREQ_FAIL'
  | 'STRUGGLE_DETECTED'
  | 'MASTERY_CONFIRMED'

export type TutorStage =
  | 'HOOK'
  | 'PREREQUISITE_BRIDGE'
  | 'CORE_EXPLANATION'
  | 'WORKED_EXAMPLE'
  | 'GUIDED_PRACTICE'
  | 'INDEPENDENT_PRACTICE'
  | 'CONSOLIDATION'

export type TutorTurnRequest = {
  sessionId: string
  studentMessage: string
  turnNumber: number
}

export type TutorSessionState = {
  sessionId: string
  stage: TutorStage
  hintsRemaining: number // 0-3
  lastTurnNumber: number
}

export type TutorTurnComplete = {
  tag: TutorTag
  stage: TutorStage
  hintsRemaining: number
  turnNumber: number
  sessionComplete: boolean
}

export type TutorTurnErrorCode =
  | 'RATE_LIMITED'
  | 'SESSION_NOT_FOUND'
  | 'AI_UNAVAILABLE'
  | 'SAFETY_BLOCK'
  | 'FEATURE_DISABLED'

export type TutorTurnError = {
  code: TutorTurnErrorCode
  message: string
  retryable: boolean
}

export async function requireTutorEnabled(studentId: string): Promise<void> {
  const enabled = await isAiTutorEnabledForStudent(studentId)
  if (!enabled) {
    const err = new Error('FEATURE_DISABLED')
    ;(err as any).code = 'FEATURE_DISABLED'
    throw err
  }
}

export async function enforceTutorFreemiumCap(studentId: string): Promise<void> {
  const premium = await isPremiumUser(studentId)
  if (premium) return

  const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3)
  const txResult = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: studentId }, select: { todaysFreeQuestionsCount: true } })
    if (!user) return { notFound: true } as const

    if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT) <= 0) {
      return { limitReached: true } as const
    }

    await tx.user.update({
      where: { id: studentId },
      data: { todaysFreeQuestionsCount: { decrement: 1 } },
      select: { id: true },
    })

    return { ok: true } as const
  })

  if ('notFound' in txResult) {
    const err = new Error('SESSION_NOT_FOUND')
    ;(err as any).code = 'SESSION_NOT_FOUND'
    throw err
  }
  if ('limitReached' in txResult) {
    const err = new Error('RATE_LIMITED')
    ;(err as any).code = 'RATE_LIMITED'
    throw err
  }
}

export async function getTutorSession(sessionId: string): Promise<TutorSessionState | null> {
  const s = await getRedisTutorSession(sessionId)
  if (!s) return null
  if (typeof s.stage !== 'string') return null
  if (typeof s.hintsRemaining !== 'number') return null
  if (typeof s.lastTurnNumber !== 'number') return null
  return {
    sessionId,
    stage: s.stage as TutorStage,
    hintsRemaining: s.hintsRemaining,
    lastTurnNumber: s.lastTurnNumber,
  }
}

export async function setTutorSession(state: TutorSessionState): Promise<void> {
  const payload: RedisSessionState = {
    sessionId: state.sessionId,
    stage: state.stage,
    hintsRemaining: state.hintsRemaining,
    lastTurnNumber: state.lastTurnNumber,
  }
  await setRedisTutorSession(state.sessionId, payload)
}

function parseTutorTag(text: string): TutorTag {
  const m = String(text).match(/\[(QUESTION|VALIDATE|HINT_OFFER|STAGE_ADVANCE|PREREQ_FAIL|STRUGGLE_DETECTED|MASTERY_CONFIRMED)\]\s*$/)
  if (!m) return 'QUESTION'
  return m[1] as TutorTag
}

function stripTutorTag(text: string): string {
  return String(text).replace(/\n?\[(QUESTION|VALIDATE|HINT_OFFER|STAGE_ADVANCE|PREREQ_FAIL|STRUGGLE_DETECTED|MASTERY_CONFIRMED)\]\s*$/m, '').trimEnd()
}

export async function runTutorOrchestrator(args: {
  studentId: string
  state: TutorSessionState
  studentMessage: string
}): Promise<{ answerText: string; complete: TutorTurnComplete }> {
  // Minimal per-turn orchestrator until the full AI-SSM pipeline lands.
  // If LLM calls are not allowed in the web runtime, surface a contract-shaped 503.
  if (process.env.LLM_MODE !== 'mock' && process.env.ALLOW_LLM_CALLS !== '1') {
    const err = new Error('AI_UNAVAILABLE')
    ;(err as any).code = 'AI_UNAVAILABLE'
    throw err
  }

  const system = `You are Vidya, an expert AI tutor. Teach using guided questions. Ask at most one question per turn. Keep answers under 150 words.
Always end your message with exactly one of these tags on a new line:
[QUESTION] [VALIDATE] [HINT_OFFER] [STAGE_ADVANCE] [PREREQ_FAIL] [STRUGGLE_DETECTED] [MASTERY_CONFIRMED]`

  const completion = await createChatCompletion({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: args.studentMessage },
    ],
    temperature: 0.4,
    max_tokens: 500,
  })

  const raw = completion?.choices?.[0]?.message?.content ?? ''
  const tag = parseTutorTag(raw)
  const answerText = stripTutorTag(raw)

  const complete: TutorTurnComplete = {
    tag,
    stage: args.state.stage,
    hintsRemaining: args.state.hintsRemaining,
    turnNumber: args.state.lastTurnNumber,
    sessionComplete: args.state.stage === 'CONSOLIDATION' && tag === 'STAGE_ADVANCE',
  }

  return { answerText, complete }
}

