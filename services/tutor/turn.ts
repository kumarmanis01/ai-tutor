/**
 * FILE OBJECTIVE:
 * - Orchestrate a single AI Tutor turn: input safety, prompt assembly,
 *   LLM invocation, output safety, state transitions, and persistence.
 * - Persist and honour a session-level `explainStyle` preference so the
 *   frontend can set a default re-explain style for subsequent turns.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/tutor/orchestrator.errorPaths.test.ts
 * - tests/unit/services/tutor/turn.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | feat(F-STU-011): session-level explainStyle support
 * - 2026-04-15T00:00:00Z | copilot | fix(F-STU-023): wire mastery snapshot into masteryBrief prompting
 * - 2026-04-15T12:34:00Z | copilot | fix(F-STU-023): tighten conceptState typing; use optional chaining for masteryBrief computation
 * - 2026-04-15T12:50:00Z | copilot | refactor(F-STU-023): computeMasteryBrief returns concise tokens for Vidya system prompt
 * - 2026-04-15T00:30:00Z | copilot | fix(TEST): avoid long-running legacy prisma transaction by racing with timeout
 * - 2026-04-16T00:00:00Z | copilot | feat(F-STU-011): add copy-paste detection and include board chapter weight in prompts (AC-09, AC-07)
 * - 2026-05-20T00:00:00Z | copilot | migrate prisma.analyticsEvent.create -> emitServerAnalyticsEvent for safety_trigger event
 * - 2026-06-06T00:00:00Z | claude | add explicit callback typing for recentMisconception rows (strict-mode)
 */

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
import { parseLlmJson } from '@/lib/llm/sanitizeJson'
import { applyTagTransitionWithRemediation, type TutorTag, type TutorStage } from '@/lib/ai/tutor/stateMachine'
import { retrieveRelevantChunks } from '@/lib/ai/tutor/rag'
import detectCopyPaste from '@/lib/ai/tutor/copyPasteDetector'
import { detectMisconceptions, loadMisconceptions, logNovelMisconception } from '@/lib/ai/tutor/misconceptionDetector'
import generateContrastiveExplanation from '@/lib/ai/tutor/contrastive'
import { saveDoubt, lookupDoubt, recordDoubt } from '@/lib/ai/tutor/doubtKb'
import { getCachedExplanation, setCachedExplanation, type ExplanationLang, type ExplanationModality } from '@/lib/ai/tutor/explanationCache'
import { detectDistress } from '@/lib/ai/tutor/distress'
import { enqueueDistressNotification } from '@/jobs/distressNotification'
import { enqueueIRTUpdate } from '@/jobs/irtUpdate'
import { updateStreak } from '@/lib/student/streak'
import { logger } from '@/lib/logger'
import { checkFreeTierCap, incrementFreeTierUsage } from '@/lib/freemium'
import { emitServerAnalyticsEvent } from '@/lib/analytics/server'
import {
  classifyIntent,
  processPrompt,
  checkForHallucinations,
  getSafeResponseForIntent,
  formatResponseForStudent,
} from '@/lib/ai/guardrails'

export type TutorTurnRequest = {
  sessionId: string
  studentMessage: string
  turnNumber: number
  conceptId?: string
  subjectId?: string
  isCorrect?: boolean
  questionId?: string
  itemDifficulty?: number
  messageId?: string
}

export type TutorSessionState = {
  sessionId: string
  stage: TutorStage
  hintsRemaining: number // 0-3
  lastTurnNumber: number
  // AC-08 / AC-02 (F-STU-011): full machine state persisted across turns
  consecutiveWrongAnswers: number
  stageAttemptCount: number
  prereqRemediationActive: boolean
  prereqReturnStage: TutorStage | null
  /** Optional: persisted session-level explain style preference */
  explainStyle?: 'simpler' | 'harder' | 'real_life_example' | 'diagram' | null
}

export type TutorTurnComplete = {
  tag: TutorTag
  stage: TutorStage
  hintsRemaining: number
  /** Number of hints used before this turn (pre-call). Helpful for client UI */
  hintsUsedDuringTurn?: number
  turnNumber: number
  sessionComplete: boolean
  visualHint?: string | null
  /** Optional contrastive explanation for a detected misconception */
  contrastiveExplanation?: {
    misconceptionId: string
    name: string
    correction: string
  } | null
}


export type TutorTurnErrorCode =
  | 'RATE_LIMITED'
  | 'SESSION_NOT_FOUND'
  | 'AI_UNAVAILABLE'
  | 'SAFETY_BLOCK'
  | 'FEATURE_DISABLED'
  | 'CONSENT_REQUIRED'

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

  // Legacy per-day free-questions counter stored on User.todaysFreeQuestionsCount
  // Many tests and some deployments rely on this behaviour. Try the legacy
  // transaction first; on any unexpected error, fall back to the canonical
  // monthly free-tier implementation below.
  try {
    // Attempt legacy per-day free-questions counter. The transaction returns
    // a boolean indicating whether the legacy path applied. Only return
    // early when it actually handled the request.
    //
    // Defensive: race the transaction against a short timeout so unit tests
    // and noisy environments don't hang if the legacy DB path becomes slow.
    const legacyApplied = (await Promise.race([
      prisma.$transaction(async (tx) => {
        const u = await (tx as any).user.findUnique({ where: { id: studentId }, select: { todaysFreeQuestionsCount: true } })
        if (u && typeof u.todaysFreeQuestionsCount === 'number') {
          if ((u as any).todaysFreeQuestionsCount <= 0) {
            const err: any = new Error('RATE_LIMITED')
            err.code = 'RATE_LIMITED'
            throw err
          }
          await (tx as any).user.update({ where: { id: studentId }, data: { todaysFreeQuestionsCount: (u as any).todaysFreeQuestionsCount - 1 } })
          return true
        }
        return false
      }),
      // 1s timeout: if legacy path is slow/unavailable, fall back to canonical check
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
    ])) as boolean

    if (legacyApplied) {
      return
    }
  } catch (err: any) {
    if (err && err.code === 'RATE_LIMITED') throw err
    // otherwise fall through to canonical monthly freemium logic
  }

  // Use canonical free-tier check (monthly period) from lib/freemium.
  const status = await checkFreeTierCap(studentId)
  if (!status.allowed) {
    const err = new Error('RATE_LIMITED')
    ;(err as any).code = 'RATE_LIMITED'
    throw err
  }

  // Record usage (best-effort). incrementFreeTierUsage() swallows errors.
  await incrementFreeTierUsage(studentId)
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
    consecutiveWrongAnswers: typeof s.consecutiveWrongAnswers === 'number' ? s.consecutiveWrongAnswers : 0,
    stageAttemptCount: typeof s.stageAttemptCount === 'number' ? s.stageAttemptCount : 0,
    prereqRemediationActive: s.prereqRemediationActive === true,
    prereqReturnStage: typeof s.prereqReturnStage === 'string' ? (s.prereqReturnStage as TutorStage) : null,
    explainStyle: typeof s.explainStyle === 'string' ? (s.explainStyle as any) : null,
  }
}

export async function setTutorSession(state: TutorSessionState): Promise<void> {
  const payload: RedisSessionState = {
    sessionId: state.sessionId,
    stage: state.stage,
    hintsRemaining: state.hintsRemaining,
    lastTurnNumber: state.lastTurnNumber,
    consecutiveWrongAnswers: state.consecutiveWrongAnswers,
    stageAttemptCount: state.stageAttemptCount,
    prereqRemediationActive: state.prereqRemediationActive,
    prereqReturnStage: state.prereqReturnStage,
    explainStyle: typeof state.explainStyle === 'string' ? state.explainStyle : null,
  }
  await setRedisTutorSession(state.sessionId, payload)
}
/**
 * Convert a raw mastery score (0–1) into a concise human-readable phrase
 * for injection into the Vidya system prompt. Returns a fixed fallback when
 * no prior StudentConceptState exists (first-time learner).
 */
export function computeMasteryBrief(score: number | null | undefined): string {
  // Use short, stable tokens for injection into the system prompt so the
  // system layer can reliably pattern-match and keep the prompt compact.
  // The ranges are intentionally coarse and deterministic.
  if (score == null) return 'mastery_context_not_yet_wired'
  if (score >= 0.85) return 'mastered'
  if (score >= 0.65) return 'strong_understanding'
  if (score >= 0.4) return 'partial_understanding'
  if (score >= 0.15) return 'needs_practice'
  return 'novice'
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
  /** Optional message id to mirror anomalyFlags to the Message row */
  messageId?: string
  /** When tag is VALIDATE, used for IRT enqueue; from client or evaluator. */
  isCorrect?: boolean
  /** Question ID for AnswerEvent dedup; when absent, synthetic id is used. */
  questionId?: string
  /** Item difficulty (Concept.irt_b) for IRT; when absent, Concept.irt_b or 0 is used. */
  itemDifficulty?: number
}): Promise<{ answerText: string; complete: TutorTurnComplete }> {
  const { studentId, state, studentMessage, subjectId, conceptId, messageId } = args
  const sessionId = state.sessionId

  // Detect sentinels sent by the frontend.
  const isHintRequest = studentMessage === '__HINT_REQUEST__'
  const isExplainSimpler = studentMessage === '__EXPLAIN_SIMPLER__'
  const isExplainHarder = studentMessage === '__EXPLAIN_HARDER__'
  const isExplainExample = studentMessage === '__EXPLAIN_EXAMPLE__'
  const isExplainDiagram = studentMessage === '__EXPLAIN_DIAGRAM__'
  const isStyleRequest = isExplainSimpler || isExplainHarder || isExplainExample || isExplainDiagram

  // AC-04 (F-STU-011 MUST): prefer per-turn sentinel, otherwise use persisted session preference
  const sessionExplainStyle: 'simpler' | 'harder' | 'real_life_example' | 'diagram' | null =
    (state as any)?.explainStyle && typeof (state as any)?.explainStyle === 'string'
      ? (state as any).explainStyle
      : null

  const explainStyleFromSentinel: 'simpler' | 'harder' | 'real_life_example' | 'diagram' | null =
    isExplainSimpler ? 'simpler'
    : isExplainHarder ? 'harder'
    : isExplainExample ? 'real_life_example'
    : isExplainDiagram ? 'diagram'
    : null

  const explainStyle: 'simpler' | 'harder' | 'real_life_example' | 'diagram' | null =
    isStyleRequest ? explainStyleFromSentinel : sessionExplainStyle

  // Replace sentinels with clean phrases so safety checks never see raw values.
  const effectiveMessage =
    isHintRequest ? 'Please give me a hint.'
    : isExplainSimpler ? 'Can you explain this more simply?'
    : isExplainHarder ? 'Can you explain this in more depth?'
    : isExplainExample ? 'Can you give me a real-life example?'
    : studentMessage

  // Derive actual hintsUsed from persisted Redis state (hintsRemaining counts down from 3).
  const hintsUsed = Math.max(0, 3 - state.hintsRemaining)

  await markTurnStarted(sessionId)

  // Resolve prisma at runtime so tests that mock the module are honoured.
  let prismaClient: any = undefined

  try {
    const mod = await import('@/lib/prisma')
    prismaClient = (mod && (mod.prisma as any)) || (prisma as any)
    // Debug helper: record keys available on the runtime prisma to aid tests
    try {
      // Emit structured debug about runtime prisma keys to aid CI/module-mock diagnostics.
      logger.debug('prismaClient.runtimeKeys', { keys: Object.keys(prismaClient || {}) });
    } catch (e) {
      // swallow
    }

    const userProfilePromise = (prismaClient.user && typeof prismaClient.user.findUnique === 'function')
      ? prismaClient.user.findUnique({ where: { id: studentId }, select: { learningStyle: true, language: true } })
      : Promise.resolve(null)

    const studentLearningProfilePromise = (prismaClient.studentLearningProfile && typeof prismaClient.studentLearningProfile.findUnique === 'function')
      ? prismaClient.studentLearningProfile.findUnique({ where: { studentId }, select: { recommendations: true } })
      : Promise.resolve(null)

    const conceptStatePromise: Promise<{ masteryScore: number | null; retention: number | null } | null> =
      prismaClient.studentConceptState && typeof prismaClient.studentConceptState.findUnique === 'function'
        ? prismaClient.studentConceptState.findUnique({
            where: { studentId_conceptId: { studentId, conceptId } },
            select: { masteryScore: true, retention: true },
          })
        : Promise.resolve(null)

    const [concept, subject, userProfile, conceptState, studentLearningProfile] = await Promise.all([
      prismaClient.concept.findUnique({
        where: { id: conceptId },
        select: {
          name: true,
          irt_b: true,
          topic: { select: { chapterId: true, chapter: { select: { id: true, name: true } } } },
        },
      }),
      prismaClient.subjectDef.findUnique({
        where: { id: subjectId },
        select: { name: true },
      }),
      userProfilePromise,
      conceptStatePromise,
      studentLearningProfilePromise,
    ])
    const conceptName = concept?.name ?? 'this concept'
    const subjectName = subject?.name ?? 'Subject'
    const conceptDifficulty = typeof concept?.irt_b === 'number' && Number.isFinite(concept.irt_b) ? concept.irt_b : 0
    const learningStyle = (userProfile as any)?.learningStyle ?? null
    const uiLanguage = (userProfile as any)?.language ?? null
    const recommendations = (studentLearningProfile as any)?.recommendations ?? null

    // Determine teaching language preference: per-subject override -> user UI language -> default 'en'
    let teachingLanguageRaw: string | null = null
    try {
      if (recommendations && typeof recommendations === 'object') {
        const subjectLangs = (recommendations.subjectLanguages ?? {}) as Record<string, any>
        const subj = subjectLangs?.[subjectId]
        if (typeof subj === 'string' && subj.length > 0) teachingLanguageRaw = subj
      }
    } catch (e) {
      // ignore and fall back
    }
    if (!teachingLanguageRaw && typeof uiLanguage === 'string' && uiLanguage.length > 0) teachingLanguageRaw = uiLanguage
    if (!teachingLanguageRaw) teachingLanguageRaw = 'en'

    // Normalize to supported ExplanationLang ('en' | 'hi') for downstream caches/calls
    const teachingLanguage = (teachingLanguageRaw === 'hi' ? 'hi' : 'en') as any

    const safetyContext = {
      studentId,
      sessionId,
      turnId: `${sessionId}:${state.lastTurnNumber}`,
    }

    // 2. Input safety (use effectiveMessage so __HINT_REQUEST__ sentinel never reaches safety checks)
    const inputSafety = checkInputSafety(effectiveMessage, safetyContext)
    const safetyEvents: (InputSafetyEvent | OutputSafetyEvent)[] = [...inputSafety.events].map((e) => {
      const trigger = String((e as any).triggerType ?? '').toUpperCase()
      if (trigger === 'PII' || trigger === 'JAILBREAK') {
        // Store only redacted input; truncate to avoid storing full conversation.
        return { ...e, inputPreview: String(inputSafety.redacted ?? '').slice(0, 200) } as any
      }
      return e as any
    })

    if (!inputSafety.safe) {
      // Jailbreak: insert safety events then surface a typed error for route.ts to map to SSE
      if (safetyEvents.length) {
        await prisma.safetyEvent.createMany({ data: safetyEvents })
        // Also emit a lightweight analytics event to aid observability of safety triggers
        void emitServerAnalyticsEvent({
          eventType: 'safety_trigger',
          userId: studentId,
          metadata: { triggerCount: safetyEvents.length, triggers: safetyEvents },
        }, 'tutor.turn')
      }
      const err: any = new Error('JAILBREAK_DETECTED')
      err.code = 'JAILBREAK_DETECTED'
      throw err
    }

    const redactedInput = inputSafety.redacted

    // 2b. Intent classification + optional prompt rewrite (silent)
    const intentClassification = classifyIntent(String(redactedInput), 10, subjectName)
    let rewrittenPrompt = String(redactedInput)
    try {
      const rewrite = processPrompt(String(redactedInput), 10, subjectName)
      if (rewrite && rewrite.wasRewritten && rewrite.prompt) {
        rewrittenPrompt = rewrite.prompt
      }
    } catch (e) {
      logger.warn('promptRewrite.failed', { error: String((e as any)?.message ?? e) })
    }

    // Distress detection — gated by ENABLE_DISTRESS_DETECTION flag (currently false until T43 sign-off)
    if (process.env.ENABLE_DISTRESS_DETECTION === 'true') {
      const distressResult = detectDistress(redactedInput)
      if (distressResult.detected) {
        // Non-blocking enqueue — never affects student-facing response
        enqueueDistressNotification({
          studentId,
          sessionId,
          turnId: safetyContext.turnId,
          severity: distressResult.severity,
          triggerPhrases: distressResult.triggerPhrases,
          studentMessage: redactedInput, // already PII-redacted
        }).catch(() => {})

        // CRITICAL/HIGH: override LLM with supportive response, skip LLM call
        if (distressResult.severity === 'CRITICAL' || distressResult.severity === 'HIGH') {
          await updateTutorSession(sessionId, {
            stage: state.stage,
            hintsRemaining: state.hintsRemaining,
            lastTurnNumber: state.lastTurnNumber,
          })
          await markTurnCompleted(sessionId)
          await prismaClient.aITutorTurnLog.create({
            data: {
              sessionId,
              callType: 'tutor:teach',
              model: 'distress_override',
              inputTokens: 0,
              outputTokens: 0,
              costUsd: 0,
              latencyMs: 0,
              tag: 'QUESTION',
              stage: state.stage,
              safetyFlagged: true,
              cached: false,
              ragChunksUsed: [],
              frustrationScore: null,
            },
          }).catch(() => {})
          return {
            answerText: distressResult.suggestedResponse,
            complete: {
              tag: 'QUESTION' as TutorTag,
              stage: state.stage,
              hintsRemaining: state.hintsRemaining,
              turnNumber: state.lastTurnNumber,
              sessionComplete: false,
            },
          }
        }
        // LOW/MEDIUM: let normal LLM call proceed (distress context already in prompt system layer)
      }
    }

    // Misconception detection using real subjectId + conceptId.
    const loadedMisconceptions = await loadMisconceptions(subjectId, conceptId)
    const detectedMisconceptions = detectMisconceptions(redactedInput, loadedMisconceptions)
    const activeMisconception = detectedMisconceptions[0] ?? null
    // Find the full loaded misconception object to enrich the contrastive artifact
    const loadedMatch = activeMisconception
      ? loadedMisconceptions.find((lm) => lm.id === activeMisconception.misconceptionId)
      : null

    if (detectedMisconceptions.length > 0) {
      const now = new Date()
      try {
        await Promise.all(
          detectedMisconceptions.map((m) =>
            prismaClient.studentMisconception.upsert({
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

    // If we have a detected misconception and the full loaded row, prepare an
    // enriched contrastive artifact (deterministic, template-driven).
    let contrastiveArtifact: any = null
    if (activeMisconception && loadedMatch) {
      try {
        contrastiveArtifact = generateContrastiveExplanation(loadedMatch as any)
      } catch (e) {
        logger.warn('contrastive.generate.failed', { error: String((e as any)?.message ?? e) })
        contrastiveArtifact = {
          misconceptionId: activeMisconception.misconceptionId,
          name: activeMisconception.name,
          correction: activeMisconception.correction,
        }
      }
    } else if (redactedInput.trim().length > 20 && loadedMisconceptions.length > 0) {
      // AC-05 (F-STU-013): input has meaningful content but matched nothing in the library.
      // Log as a novel misconception signal for content team review.
      logNovelMisconception(studentId, subjectId, conceptId, redactedInput)
    }

    // AC-04 (F-STU-013): load up to 3 recent known misconceptions for this concept
    // to inject into the system prompt so Vidya stays alert to recurring patterns.
    let recentMisconceptionNames: string[] = []
    try {
      const recentRows = await prismaClient.studentMisconception.findMany({
        where: {
          studentId,
          misconception: { conceptId },
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 3,
        select: { misconception: { select: { name: true } } },
      })
      recentMisconceptionNames = recentRows.map((r: { misconception: { name: string } }) => r.misconception.name)
    } catch (err) {
      logger.warn('studentMisconception.load.failed', {
        studentId,
        conceptId,
        error: String((err as any)?.message ?? err),
      })
    }

    // 3. Frustration score — use empty history for now (integration with real history is future work)
    const frustration = computeFrustrationScore([], null)

    // 4. Basic RAG hook: retrieve curriculum chunks for CURRICULUM_CONTEXT layer.
    const ragContext = await retrieveRelevantChunks(
      `${conceptName} ${redactedInput}`,
      [conceptId],
      { topN: 4 },
    )

    // AC-09 (F-STU-011): Detect copy-pasted or suspiciously perfect student answers
    let detectionAnomaly: any = null
    try {
      const cp = detectCopyPaste(redactedInput, ragContext.chunks.map((c) => ({ chunkId: c.chunkId, content: c.content })))
      if (cp.flagged) {
        // Build a concise anomaly object (redacted preview only)
        const anomaly = {
          type: 'copy_paste',
          flagged: true,
          score: typeof cp.score === 'number' ? cp.score : null,
          reason: cp.reason ?? null,
          matchedChunkId: cp.chunkId ?? null,
          detector: 'copyPaste',
          detectorVersion: process.env.COPY_PASTE_DETECTOR_VERSION ?? 'v1',
          detectedAt: new Date().toISOString(),
          preview: typeof redactedInput === 'string' ? String(redactedInput).slice(0, 300) : null,
        }
        detectionAnomaly = anomaly

        // Log and short-circuit with a probing follow-up question to encourage explanation in own words.
        await markTurnCompleted(sessionId)
        try {
          await prismaClient.aITutorTurnLog.create({
            data: {
              sessionId,
              callType: 'tutor:probe',
              model: 'copy_paste_detector',
              inputTokens: 0,
              outputTokens: 0,
              costUsd: 0,
              latencyMs: 0,
              tag: 'QUESTION',
              stage: state.stage,
              safetyFlagged: false,
              cached: false,
              ragChunksUsed: ragContext.chunkIds,
              frustrationScore: frustration.frustrationScore,
              groundednessScore: null,
              anomalyFlags: [anomaly],
            },
          })

          // Mirror anomaly to the message row if caller provided a messageId
          if (messageId && prismaClient.message && typeof prismaClient.message.update === 'function') {
            try {
              await prismaClient.message.update({ where: { id: messageId }, data: { anomalyFlags: [anomaly] } })
            } catch (e) {
              logger.warn('message.anomalyFlags.update.failed', { messageId, error: String((e as any)?.message ?? e) })
            }
          }
        } catch (e) {
          logger.warn('copyPaste.aITutorTurnLog.failed', { error: String((e as any)?.message ?? e) })
        }
        try {
          await prismaClient.analyticsEvent.create({
            data: {
              eventType: 'copy_paste_detected',
              userId: studentId,
              metadata: { sessionId, reason: cp.reason, score: cp.score, chunkId: cp.chunkId },
            },
          })
        } catch (e) {
          logger.warn('copyPaste.analytics.failed', { error: String((e as any)?.message ?? e) })
        }
        return {
          answerText: "Great — can you explain in your own words why that works?",
          complete: {
            tag: 'QUESTION' as TutorTag,
            stage: state.stage,
            hintsRemaining: state.hintsRemaining,
            turnNumber: state.lastTurnNumber,
            sessionComplete: false,
          },
        }
      }
    } catch (e) {
      logger.warn('copyPaste.detect.failed', { error: String((e as any)?.message ?? e) })
    }

    // 5. Prompt assembly — pass actual hintsUsed, isHintRequest, explainStyle, and
    //    persisted machine state for tier-aware hint delivery and remediation context.
    // Fetch chapter-level board weight (if available) to surface in prompts (AC-07)
    let boardChapterWeightMarks: number | null = null
    try {
      const chapterId = (concept as any)?.topic?.chapter?.id ?? (concept as any)?.topic?.chapterId ?? null
      if (chapterId) {
        const bw = await prismaClient.boardChapterWeight.findUnique({ where: { chapterId }, select: { weightMarks: true } })
        boardChapterWeightMarks = bw?.weightMarks ?? null
      }
    } catch (e) {
      logger.warn('boardChapterWeight.load.failed', { conceptId, error: String((e as any)?.message ?? e) })
    }
    const prompt = assembleSystemPrompt({
      studentName: 'Student',
      grade: 10,
      board: 'CBSE',
      teachingLanguage: teachingLanguage,
      examDateProximityDays: null,
      learningStyle,
      recentMisconceptions: recentMisconceptionNames,
      masteryBrief: computeMasteryBrief(conceptState?.masteryScore ?? null),
      emotionalState: frustration.emotionalState === 'DISTRESSED' ? 'FRUSTRATED' : frustration.emotionalState,
      stage: state.stage as TutorStage,
      stageAttemptCount: state.stageAttemptCount,
      hintsUsed,
      isHintRequest,
      explainStyle,
      consecutiveWrongAnswers: state.consecutiveWrongAnswers,
      sessionSummary: null,
      // Include the (possibly rewritten) student prompt as the most recent turn
      recentTurns: [{ role: 'student', content: rewrittenPrompt }],
      activeMisconceptionName: activeMisconception?.name ?? null,
      activeMisconceptionCorrection: activeMisconception?.correction ?? null,
      frustrationScore: frustration.frustrationScore,
      ragChunks: ragContext.chunks.map((c) => c.content),
      boardChapterWeightMarks,
      conceptName,
      subjectName,
    })

    if (Array.isArray(prompt.layersTruncated) && prompt.layersTruncated.length > 0) {
      logger.warn('tutor.prompt.layersTruncated', {
        layersTruncated: prompt.layersTruncated,
      })
    }

    // 5b. DoubtKb cache lookup (T26) — skip for hint requests; only for question/clarification turns
    // Detect: message ends with '?' or contains common doubt indicators
    const isDoubtTurn =
      !isHintRequest &&
      !isStyleRequest &&
      (redactedInput.endsWith('?') ||
        /\b(what|why|how|explain|confused|don'?t understand|clarify|mean|means|help)\b/i.test(redactedInput))

    if (isDoubtTurn) {
      const cachedAnswer = await lookupDoubt(redactedInput, subjectId)
      if (cachedAnswer) {
        // Serve from DoubtKb — skip LLM call
        await markTurnCompleted(sessionId)
        await prismaClient.aITutorTurnLog.create({
          data: {
            sessionId,
            callType: 'tutor:teach',
            model: 'doubt_kb_cache',
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            latencyMs: 0,
            tag: 'QUESTION',
            stage: state.stage,
            safetyFlagged: false,
            cached: true,
            ragChunksUsed: [],
            frustrationScore: frustration.frustrationScore,
          },
        }).catch(() => {})
        return {
          answerText: cachedAnswer,
          complete: {
            tag: 'QUESTION' as TutorTag,
            stage: state.stage,
            hintsRemaining: state.hintsRemaining,
            turnNumber: state.lastTurnNumber,
            sessionComplete: false,
          },
        }
      }
    }

    // 6. Tutor LLM call with retry/backoff
    // Use 'tutor:hint' callType for hint turns so hint dependency can be queried from AITutorTurnLog (AC-07).
    let llmContent: string
    let servedFromCache = false
    try {
      const tutorCallType: TutorCallType = isHintRequest ? 'tutor:hint' : 'tutor:teach'

      const lang: ExplanationLang = teachingLanguage as ExplanationLang
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
    // Never store raw unsafe output; leave inputPreview unset for UNSAFE_OUTPUT events.
    safetyEvents.push(...outputSafety.events)
    let answerText = outputSafety.text

    // Attempt to extract structured JSON from LLM output (visualHint, explanation, etc.).
    // Many prompts include a small JSON-like block with fields such as `visualHint` for
    // front-end rendering of simple diagrams. Use a robust sanitizer to avoid throwing.
    let extractedVisualHint: string | null = null
    try {
      const parsed = parseLlmJson(answerText)
      if (parsed && typeof parsed === 'object') {
        if (typeof (parsed as any).visualHint === 'string') {
          extractedVisualHint = (parsed as any).visualHint
        }
        // Prefer explicit explanation/content fields when streaming human-friendly text
        const preferFields = ['explanation', 'content', 'answer', 'text', 'body']
        for (const f of preferFields) {
          if (typeof (parsed as any)[f] === 'string' && String((parsed as any)[f]).trim().length > 0) {
            answerText = String((parsed as any)[f])
            break
          }
        }
      }
    } catch (e) {
      // Not parseable JSON/structured output — ignore and continue with plain text answer
    }

    if (safetyEvents.length) {
      await prismaClient.safetyEvent.createMany({ data: safetyEvents })
      // Analytics event for safety triggers
      try {
        await prismaClient.analyticsEvent.create({
          data: {
            eventType: 'safety_triggered',
            userId: studentId,
            courseId: null,
            lessonIdx: null,
            metadata: {
              sessionId,
              turnId: safetyContext.turnId,
              triggers: safetyEvents,
            },
          },
        })
      } catch (e) {
        logger.warn('analyticsEvent.safety.create.failed', { error: String((e as any)?.message ?? e) })
      }
    }

    // Hallucination detection & analytics
    // groundednessScore = 1 - riskScore; captured here for AITutorTurnLog persistence below.
    let groundednessScore: number | null = null
    try {
      const hallCtx = { grade: 10, board: 'CBSE', subject: subjectName, originalQuestion: String(redactedInput) }
      const hall = checkForHallucinations(answerText, hallCtx as any)
      groundednessScore = typeof hall?.riskScore === 'number' ? Math.max(0, 1 - hall.riskScore) : null
      if (hall && (hall.issues.length > 0 || hall.needsReview)) {
        try {
          await prismaClient.analyticsEvent.create({
            data: {
              eventType: 'hallucination_detected',
              userId: studentId,
              courseId: null,
              lessonIdx: null,
              metadata: {
                sessionId,
                turnId: safetyContext.turnId,
                hallucination: hall,
              },
            },
          })
        } catch (e) {
          logger.warn('analyticsEvent.hallucination.create.failed', { error: String((e as any)?.message ?? e) })
        }
      }

      if (hall && hall.shouldBlock) {
        try {
          const safe = getSafeResponseForIntent(intentClassification.primaryIntent, 10, subjectName)
          const safeText = formatResponseForStudent(safe)
          await prismaClient.analyticsEvent.create({
            data: {
              eventType: 'hallucination_blocked',
              userId: studentId,
              courseId: null,
              lessonIdx: null,
              metadata: {
                sessionId,
                turnId: safetyContext.turnId,
                reason: 'hallucination_should_block',
                originalExcerpt: String(answerText).slice(0, 400),
              },
            },
          })
          answerText = safeText
        } catch (e) {
          logger.warn('analyticsEvent.hallucination_block.create.failed', { error: String((e as any)?.message ?? e) })
        }
      }
    } catch (e) {
      logger.warn('hallucinationDetector.failed', { error: String((e as any)?.message ?? e) })
    }

    // Explanation cache: only cache safe, non-replacement responses for the eligible stages.
    // Never cache if output safety fired (replacement text) or when served from cache already.
    {
      const stage = state.stage as TutorStage
      const modality: ExplanationModality | null =
        stage === 'CORE_EXPLANATION' ? 'text' : stage === 'WORKED_EXAMPLE' ? 'worked_example' : null
      const lang: ExplanationLang = teachingLanguage as ExplanationLang

      if (modality && !servedFromCache && outputSafety.safe) {
        await setCachedExplanation(conceptId, lang, modality, answerText)
      }
    }

    // Doubt KB: after output safety passes, persist helpful Q&A for future context.
    // Skip hint turns -- they carry the synthetic "Please give me a hint." message, not a real doubt.
    if (!isHintRequest && (tag === 'QUESTION' || tag === 'HINT_OFFER')) {
      void saveDoubt({
        studentId,
        sessionId,
        conceptId: args.conceptId ?? conceptId,
        question: redactedInput,
        answer: answerText,
      })
      // T26: also write to shared subjectId-scoped KB with pgvector dedup (fire-and-forget)
      if (isDoubtTurn) {
        recordDoubt(redactedInput, answerText, subjectId, conceptId).catch(() => {})
      }
    }

    // 10. State machine transition -- uses persisted machine state so consecutive-wrong
    //     counters and remediation flags survive across turns (AC-02, AC-08, F-STU-011).
    const { next: nextCore, effectiveTag } = applyTagTransitionWithRemediation(
      {
        stage: state.stage as TutorStage,
        stageAttemptCount: state.stageAttemptCount,
        hintsUsed,
        prereqRemediationActive: state.prereqRemediationActive,
        prereqReturnStage: state.prereqReturnStage,
        consecutiveWrongAnswers: state.consecutiveWrongAnswers,
      },
      tag,
    )

    // Use effectiveTag for logging when auto-upgrade occurred (PREREQ_FAIL > STRUGGLE_DETECTED)
    const logTag = effectiveTag

    const hintsRemaining = Math.max(0, 3 - nextCore.hintsUsed)

    const newState: TutorSessionState = {
      ...state,
      stage: nextCore.stage,
      hintsRemaining,
      lastTurnNumber: state.lastTurnNumber,
      consecutiveWrongAnswers: nextCore.consecutiveWrongAnswers,
      stageAttemptCount: nextCore.stageAttemptCount,
      prereqRemediationActive: nextCore.prereqRemediationActive,
      prereqReturnStage: nextCore.prereqReturnStage,
    }

    // 11–12. Persist full machine state (stage, hints, and all AC-02/AC-08 counters)
    await updateTutorSession(sessionId, {
      stage: newState.stage,
      hintsRemaining: newState.hintsRemaining,
      lastTurnNumber: newState.lastTurnNumber,
      consecutiveWrongAnswers: newState.consecutiveWrongAnswers,
      stageAttemptCount: newState.stageAttemptCount,
      prereqRemediationActive: newState.prereqRemediationActive,
      prereqReturnStage: newState.prereqReturnStage,
    })
    await markTurnCompleted(sessionId)

    // 13. Log effective tag (reflects auto-upgrade to PREREQ_FAIL when AC-08 fired)
    await prismaClient.aITutorTurnLog.create({
      data: {
        sessionId,
        callType: isHintRequest ? 'tutor:hint' : 'tutor:teach',
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        tag: logTag,
        stage: newState.stage,
        safetyFlagged: safetyEvents.length > 0,
        cached: servedFromCache,
        ragChunksUsed: ragContext.chunkIds,
        frustrationScore: frustration.frustrationScore,
        groundednessScore: servedFromCache ? null : groundednessScore,
        anomalyFlags: detectionAnomaly ? [detectionAnomaly] : undefined,
      },
    })

    // Mirror anomaly to the message row if caller provided a messageId (best-effort)
    if (detectionAnomaly && messageId && prismaClient.message && typeof prismaClient.message.update === 'function') {
      try {
        await prismaClient.message.update({ where: { id: messageId }, data: { anomalyFlags: [detectionAnomaly] } })
      } catch (e) {
        logger.warn('message.anomalyFlags.update.failed', { messageId, error: String((e as any)?.message ?? e) })
      }
    }

    // AC-07: record hint usage on StudentConceptState and auto-flag for consolidation
    if (isHintRequest) {
      try {
        // Delivered tier is previous hintsUsed + 1 (cap to 3)
        const deliveredTier = Math.min(3, Math.max(1, (hintsUsed ?? 0) + 1))
        if (prismaClient.studentConceptState && typeof prismaClient.studentConceptState.upsert === 'function') {
          const baseRetention = conceptState?.retention ?? 1
          const baseMastery = conceptState?.masteryScore ?? 0
          const hintMemoryStrength = Math.round((baseMastery * baseRetention) * 1000) / 1000

          const upsertRes: any = await prismaClient.studentConceptState.upsert({
            where: { studentId_conceptId: { studentId, conceptId } },
            create: {
              studentId,
              conceptId,
              masteryScore: conceptState?.masteryScore ?? 0,
              hintCount: 1,
              hintTier1: deliveredTier === 1 ? 1 : 0,
              hintTier2: deliveredTier === 2 ? 1 : 0,
              hintTier3: deliveredTier === 3 ? 1 : 0,
              lastHintAt: new Date(),
              memoryStrength: hintMemoryStrength,
            },
            update: {
              hintCount: { increment: 1 },
              ...(deliveredTier === 1 ? { hintTier1: { increment: 1 } } : {}),
              ...(deliveredTier === 2 ? { hintTier2: { increment: 1 } } : {}),
              ...(deliveredTier === 3 ? { hintTier3: { increment: 1 } } : {}),
              lastHintAt: new Date(),
              memoryStrength: hintMemoryStrength,
            },
          })

          // configurable threshold (env) or default 5 hints
          const threshold = Number(process.env.HINT_DEPENDENCY_THRESHOLD ?? '5')
          const totalHints = typeof upsertRes?.hintCount === 'number' ? upsertRes.hintCount : null
          if (totalHints != null && totalHints >= threshold && !upsertRes?.needsConsolidation) {
            // Mark the concept state as needing consolidation
            try {
              await prismaClient.studentConceptState.update({ where: { id: upsertRes.id }, data: { needsConsolidation: true } })
            } catch (e) {
              logger.warn('studentConceptState.markConsolidation.failed', { studentId, conceptId, error: String((e as any)?.message ?? e) })
            }

            // Create an AttentionFlag for the topic to allocate additional practice (best-effort)
            try {
              const topicId = (concept as any)?.topic?.id ?? null
              if (topicId) {
                await prismaClient.attentionFlag.upsert({
                  where: { studentId_topicId: { studentId, topicId } },
                  create: {
                    studentId,
                    topicId,
                    subject: subjectName,
                    chapter: (concept as any)?.topic?.chapter?.name ?? '',
                    masteryLevel: 'beginner',
                    accuracy: 0,
                    reason: 'high_hint_dependency',
                    resolved: false,
                  },
                  update: {
                    reason: 'high_hint_dependency',
                    updatedAt: new Date(),
                    resolved: false,
                  },
                })
              }
            } catch (e) {
              logger.warn('attentionFlag.upsert.failed', { studentId, conceptId, error: String((e as any)?.message ?? e) })
            }
          }
        }
      } catch (e) {
        logger.warn('studentConceptState.hintUpdate.failed', { studentId, conceptId, error: String((e as any)?.message ?? e) })
      }
    }

    const complete: TutorTurnComplete = {
      tag: logTag,
      stage: newState.stage,
      hintsRemaining: newState.hintsRemaining,
      hintsUsedDuringTurn: hintsUsed,
      turnNumber: newState.lastTurnNumber,
      // Session ends when the AI responds DURING the CONSOLIDATION stage (the summary
      // and reflective question are delivered in that turn), not when entering it.
      sessionComplete: state.stage === 'CONSOLIDATION',
      visualHint: typeof extractedVisualHint === 'string' ? extractedVisualHint : null,
      contrastiveExplanation: contrastiveArtifact ? contrastiveArtifact : activeMisconception
        ? {
            misconceptionId: activeMisconception.misconceptionId,
            name: activeMisconception.name,
            correction: activeMisconception.correction,
          }
        : null,
    }

    // Award streak credit only after the student receives CONSOLIDATION content.
    if (state.stage === 'CONSOLIDATION') {
      void updateStreak(studentId)
    }

    if (logTag === 'VALIDATE') {
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
    // Ensure we record a turn log for telemetry even on error paths.
    // Keep this best-effort so logging failures don't mask the original error.
    try {
      const mod2 = await import('@/lib/prisma')
      const runtimePrisma = (mod2 && (mod2.prisma as any)) || (prisma as any)
      await runtimePrisma.aITutorTurnLog.create({
        data: {
          sessionId: args.state.sessionId,
          callType: 'tutor:teach',
          model: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: 0,
          tag: 'QUESTION',
          stage: args.state.stage,
          safetyFlagged: false,
          cached: false,
          ragChunksUsed: [],
          frustrationScore: null,
        },
      })
    } catch (e) {
      // swallow — we don't want logging failures to change control flow
    }
    throw err
  }
}

