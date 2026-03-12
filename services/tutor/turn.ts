import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'
import { isAiTutorEnabledForStudent } from '@/lib/features/aiTutor'
import { callTutorLLM, LLMError, type TutorCallType } from '@/lib/callLLM'
import {
  getTutorSession as getRedisTutorSession,
  setTutorSession as setRedisTutorSession,
  updateTutorSession,
  markTurnStarted,
  markTurnCompleted,
  type RedisSessionState,
} from '@/lib/redis/tutorSession'
import { checkInputSafety, type SafetyEventCreate as InputSafetyEvent } from '@/lib/ai/tutor/inputSafety'
import { computeFrustrationScore } from '@/lib/ai/tutor/signals'
import { assembleSystemPrompt } from '@/lib/ai/tutor/promptAssembly'
import { parseTutorTag, stripTag } from '@/lib/ai/tutor/tagParser'
import { checkOutputSafety, type SafetyEventCreate as OutputSafetyEvent } from '@/lib/ai/tutor/outputSafety'
import { applyTagTransition, type TutorTag, type TutorStage } from '@/lib/ai/tutor/stateMachine'
import { retrieveRelevantChunks } from '@/lib/ai/tutor/rag'
import { detectMisconceptions, loadMisconceptions } from '@/lib/ai/tutor/misconceptionDetector'
import { saveDoubt } from '@/lib/ai/tutor/doubtKb'
import { getCachedExplanation, setCachedExplanation, type ExplanationLang, type ExplanationModality } from '@/lib/ai/tutor/explanationCache'
import { enqueueIRTUpdate } from '@/jobs/irtUpdate'
import { logger } from '@/lib/logger'

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
/**
 * Orchestrate a single tutor turn:
 * 1. Mark turn started in Redis.
 * 2. Run input safety (PII + jailbreak).
 * 3. Compute frustration signals.
 * 4. Assemble system prompt.
 * 5. Call LLM via tutor-specific retry wrapper.
 * 6–7. Parse and strip tutor tag.
 * 8. Run output safety.
 * 9–11. Apply state transition, persist session, mark turn completed.
 * 12. Log tag to AITutorTurnLog.
 */
export async function runTutorOrchestrator(args: {
  studentId: string
  state: TutorSessionState
  studentMessage: string
  subjectId: string
  conceptId: string
  /** When tag is VALIDATE, used for IRT enqueue; from client or evaluator. */
  isCorrect?: boolean
  /** Question ID for AnswerEvent dedup; when absent, synthetic id is used. */
  questionId?: string
  /** Item difficulty (Concept.irt_b) for IRT; when absent, Concept.irt_b or 0 is used. */
  itemDifficulty?: number
}): Promise<{ answerText: string; complete: TutorTurnComplete }> {
  const { studentId, state, studentMessage, subjectId, conceptId } = args
  const sessionId = state.sessionId

  await markTurnStarted(sessionId)

  try {
    const concept = await prisma.concept.findUnique({
      where: { id: conceptId },
      select: { name: true, irt_b: true },
    })
    const subject = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: { name: true },
    })
    const conceptName = concept?.name ?? 'this concept'
    const subjectName = subject?.name ?? 'Subject'
    const conceptDifficulty = typeof concept?.irt_b === 'number' && Number.isFinite(concept.irt_b) ? concept.irt_b : 0

    const safetyContext = {
      studentId,
      sessionId,
      turnId: `${sessionId}:${state.lastTurnNumber}`,
    }

    // 2. Input safety
    const inputSafety = checkInputSafety(studentMessage, safetyContext)
    const safetyEvents: (InputSafetyEvent | OutputSafetyEvent)[] = [...inputSafety.events]

    if (!inputSafety.safe) {
      // Jailbreak: insert safety events then surface a typed error for route.ts to map to SSE
      if (safetyEvents.length) {
        await prisma.safetyEvent.createMany({ data: safetyEvents })
      }
      const err: any = new Error('JAILBREAK_DETECTED')
      err.code = 'JAILBREAK_DETECTED'
      throw err
    }

    const redactedInput = inputSafety.redacted

    // Misconception detection using real subjectId + conceptId.
    const loadedMisconceptions = await loadMisconceptions(subjectId, conceptId)
    const detectedMisconceptions = detectMisconceptions(redactedInput, loadedMisconceptions)
    const activeMisconception = detectedMisconceptions[0]?.name ?? null

    if (detectedMisconceptions.length > 0) {
      const now = new Date()
      try {
        await Promise.all(
          detectedMisconceptions.map((m) =>
            (prisma as any).studentMisconception.upsert({
              where: {
                studentId_misconceptionId: {
                  studentId,
                  misconceptionId: m.misconceptionId,
                },
              },
              create: {
                studentId,
                misconceptionId: m.misconceptionId,
                firstDetectedAt: now,
                lastSeenAt: now,
                occurrenceCount: 1,
              },
              update: {
                lastSeenAt: now,
                occurrenceCount: { increment: 1 },
              },
            }),
          ),
        )
      } catch (err) {
        logger.warn('studentMisconception.upsert.failed', {
          studentId,
          count: detectedMisconceptions.length,
          error: String((err as any)?.message ?? err),
        })
      }
    }

    // 3. Frustration score — use empty history for now (integration with real history is future work)
    const frustration = computeFrustrationScore([], null)

    // 4. Basic RAG hook: retrieve curriculum chunks for CURRICULUM_CONTEXT layer.
    const ragContext = await retrieveRelevantChunks(
      `${conceptName} ${redactedInput}`,
      [conceptId],
      { topN: 4 },
    )

    // 5. Prompt assembly — minimal but structured PromptContext
    const prompt = assembleSystemPrompt({
      studentName: 'Student',
      grade: 10,
      board: 'CBSE',
      teachingLanguage: 'en',
      examDateProximityDays: null,
      learningStyle: null,
      recentMisconceptions: [],
      masteryBrief: 'mastery_context_not_yet_wired',
      emotionalState: frustration.emotionalState,
      stage: state.stage as TutorStage,
      stageAttemptCount: 0,
      hintsUsed: 0,
      sessionSummary: null,
      recentTurns: [],
      activeMisconceptionName: activeMisconception,
      frustrationScore: frustration.frustrationScore,
      ragChunks: ragContext.chunks.map((c) => c.content),
      conceptName,
      subjectName,
    })

    if (prompt.layersTruncated.length > 0) {
      logger.warn('tutor.prompt.layersTruncated', {
        layersTruncated: prompt.layersTruncated,
      })
    }

    // 6. Tutor LLM call with retry/backoff
    let llmContent: string
    let servedFromCache = false
    try {
      const tutorCallType: TutorCallType = 'tutor:teach'

      const lang: ExplanationLang = 'en'
      const stage = state.stage as TutorStage
      const modality: ExplanationModality | null =
        stage === 'CORE_EXPLANATION' ? 'text' : stage === 'WORKED_EXAMPLE' ? 'worked_example' : null

      if (modality) {
        const cached = await getCachedExplanation(conceptId, lang, modality)
        if (cached?.content) {
          // Append a default machine tag so downstream tag parser/stripper remains consistent.
          llmContent = `${cached.content}\n[QUESTION]`
          servedFromCache = true
        } else {
          const res = await callTutorLLM(prompt.system, { callType: tutorCallType, sessionId, studentId }, undefined)
          llmContent = res.content
        }
      } else {
        const res = await callTutorLLM(prompt.system, { callType: tutorCallType, sessionId, studentId }, undefined)
        llmContent = res.content
      }
    } catch (err) {
      if (err instanceof LLMError) {
        // Surface typed tutor LLM errors back to the route for SSE mapping
        throw err
      }
      const e: any = new LLMError('AI_UNAVAILABLE', 'Tutor LLM failed')
      e.cause = err
      throw e
    }

    // 7–8. Tag parse + strip
    const tag: TutorTag = parseTutorTag(llmContent) ?? 'QUESTION'
    const stripped = stripTag(llmContent)

    // 9. Output safety
    const outputSafety = checkOutputSafety(stripped, safetyContext)
    safetyEvents.push(...outputSafety.events)
    const answerText = outputSafety.text

    if (safetyEvents.length) {
      await prisma.safetyEvent.createMany({ data: safetyEvents })
    }

    // Explanation cache: only cache safe, non-replacement responses for the eligible stages.
    // Never cache if output safety fired (replacement text) or when served from cache already.
    {
      const stage = state.stage as TutorStage
      const modality: ExplanationModality | null =
        stage === 'CORE_EXPLANATION' ? 'text' : stage === 'WORKED_EXAMPLE' ? 'worked_example' : null
      const lang: ExplanationLang = 'en'

      if (modality && !servedFromCache && outputSafety.safe) {
        await setCachedExplanation(conceptId, lang, modality, answerText)
      }
    }

    // Doubt KB: after output safety passes, persist helpful Q&A for future context.
    if (tag === 'QUESTION' || tag === 'HINT_OFFER') {
      void saveDoubt({
        studentId,
        sessionId,
        conceptId: args.conceptId ?? conceptId,
        question: redactedInput,
        answer: answerText,
      })
    }

    // 10. State machine transition — derive next stage + hint usage from tag
    const nextCore = applyTagTransition(
      {
        stage: state.stage as TutorStage,
        stageAttemptCount: 0,
        hintsUsed: 0,
        prereqRemediationActive: false,
        prereqReturnStage: null,
        consecutiveWrongAnswers: 0,
      },
      tag,
    )

    const hintsRemaining = Math.max(0, 3 - nextCore.hintsUsed)

    const newState: TutorSessionState = {
      ...state,
      stage: nextCore.stage,
      hintsRemaining,
      lastTurnNumber: state.lastTurnNumber,
    }

    // 11–12. Persist session state and mark turn completed
    await updateTutorSession(sessionId, {
      stage: newState.stage,
      hintsRemaining: newState.hintsRemaining,
      lastTurnNumber: newState.lastTurnNumber,
    })
    await markTurnCompleted(sessionId)

    // 13. Log tag to AITutorTurnLog.tag and rag chunk usage
    await prisma.aITutorTurnLog.create({
      data: {
        sessionId,
        callType: 'tutor:teach',
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        tag,
        stage: newState.stage,
        safetyFlagged: safetyEvents.length > 0,
        cached: servedFromCache,
        ragChunksUsed: ragContext.chunkIds,
        frustrationScore: frustration.frustrationScore,
      },
    })

    const complete: TutorTurnComplete = {
      tag,
      stage: newState.stage,
      hintsRemaining: newState.hintsRemaining,
      turnNumber: newState.lastTurnNumber,
      sessionComplete: newState.stage === 'CONSOLIDATION',
    }

    if (tag === 'VALIDATE') {
      await enqueueIRTUpdate({
        studentId,
        conceptId,
        questionId: args.questionId ?? `${sessionId}:${state.lastTurnNumber}`,
        sessionId,
        isCorrect: args.isCorrect ?? false,
        itemDifficulty: Number.isFinite(args.itemDifficulty) ? args.itemDifficulty! : conceptDifficulty,
        studentAnswer: redactedInput,
      })
    }

    return { answerText, complete }
  } catch (err) {
    // Always mark turn completed on any error path
    await markTurnCompleted(args.state.sessionId)
    throw err
  }
}

