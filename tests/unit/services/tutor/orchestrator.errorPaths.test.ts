/**
 * Unit tests for tutor orchestrator error and fallback paths.
 */
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn(), setex: jest.fn() }) }))

const prismaMock = {
  concept: { findUnique: jest.fn().mockResolvedValue({ name: 'Algebra', irt_b: 0.5 }) },
  subjectDef: { findUnique: jest.fn().mockResolvedValue({ name: 'Mathematics' }) },
  user: { findUnique: jest.fn().mockResolvedValue({ learningStyle: 'visual' }) },
  studentConceptState: { findUnique: jest.fn().mockResolvedValue({ masteryScore: 0.5 }) },
  safetyEvent: { createMany: jest.fn() },
  aITutorTurnLog: { create: jest.fn() },
  analyticsEvent: { create: jest.fn() },
  message: { update: jest.fn() },
  $transaction: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

jest.mock('@/lib/callLLM', () => ({
  callTutorLLM: jest.fn(),
  LLMError: class LLMError extends Error { constructor(code, message) { super(message); this.code = code } },
}))

jest.mock('@/lib/ai/tutor/promptAssembly', () => ({ assembleSystemPrompt: jest.fn().mockReturnValue({ system: 'sys' }) }))
jest.mock('@/lib/ai/tutor/outputSafety', () => ({ checkOutputSafety: jest.fn().mockImplementation((t) => ({ text: t, safe: true, events: [] })) }))
jest.mock('@/lib/ai/tutor/rag', () => ({ retrieveRelevantChunks: jest.fn().mockResolvedValue({ chunks: [], chunkIds: [] }) }))
jest.mock('@/lib/ai/tutor/copyPasteDetector', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ flagged: false })) }))
jest.mock('@/lib/ai/tutor/explanationCache', () => ({ getCachedExplanation: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/ai/tutor/misconceptionDetector', () => ({ loadMisconceptions: jest.fn().mockResolvedValue([]), detectMisconceptions: jest.fn().mockReturnValue([]) }))
jest.mock('@/lib/ai/tutor/doubtKb', () => ({ lookupDoubt: jest.fn().mockResolvedValue(null), saveDoubt: jest.fn(), recordDoubt: jest.fn() }))
jest.mock('@/lib/ai/tutor/signals', () => ({ computeFrustrationScore: jest.fn().mockReturnValue({ frustrationScore: 0, emotionalState: 'calm' }) }))
jest.mock('@/lib/ai/tutor/stateMachine', () => ({ applyTagTransition: jest.fn().mockReturnValue({ stage: 'HOOK', stageAttemptCount: 0, hintsUsed: 0, prereqRemediationActive: false, prereqReturnStage: null, consecutiveWrongAnswers: 0 }) }))

import { runTutorOrchestrator } from '@/services/tutor/turn'
import { callTutorLLM, LLMError } from '@/lib/callLLM'

describe('orchestrator error paths (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks turn completed and rethrows LLMError when LLM fails with LLMError', async () => {
    (callTutorLLM as jest.Mock).mockRejectedValueOnce(new (LLMError as any)('AI_UNAVAILABLE', 'down'))

    await expect(
      runTutorOrchestrator({
        studentId: 's1',
        state: { sessionId: 'sess1', stage: 'HOOK', hintsRemaining: 3, lastTurnNumber: 1 },
        studentMessage: 'help',
        subjectId: 'subj1',
        conceptId: 'c1',
      }),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })

    // Ensure turn completed recorded (via Redis mock in the orchestrator)
    expect(prismaMock.aITutorTurnLog.create).toHaveBeenCalled() // LLM failures also log a turn
  })

  it('copy-paste detection short-circuits and logs anomalyFlags', async () => {
    const cpMock = require('@/lib/ai/tutor/copyPasteDetector').default
    cpMock.mockReturnValueOnce({ flagged: true, score: 0.95, reason: 'exact_match', chunkId: 'chunk-1' })

    const res = await runTutorOrchestrator({
      studentId: 's3',
      state: { sessionId: 'sess3', stage: 'HOOK', hintsRemaining: 3, lastTurnNumber: 3 },
      studentMessage: 'copy text',
      subjectId: 'subj1',
      conceptId: 'c1',
      messageId: 'msg-1',
    })

    // Should short-circuit with probe
    expect(res.answerText).toMatch(/explain in your own words/i)

    // Ensure we logged a probe turn that includes anomalyFlags
    const calls = prismaMock.aITutorTurnLog.create.mock.calls
    const probeCall = calls.find((c) => c[0] && c[0].data && c[0].data.callType === 'tutor:probe')
    expect(probeCall).toBeDefined()
    expect(probeCall[0].data.anomalyFlags).toBeDefined()
    expect(Array.isArray(probeCall[0].data.anomalyFlags)).toBe(true)
    expect(probeCall[0].data.anomalyFlags[0].type).toBe('copy_paste')
    // Ensure message row was updated with anomalyFlags when messageId provided
    expect(prismaMock.message.update).toHaveBeenCalled()
    const updArg = prismaMock.message.update.mock.calls[0][0]
    expect(updArg.where).toEqual({ id: 'msg-1' })
    expect(Array.isArray(updArg.data.anomalyFlags)).toBe(true)
  })

  it('on generic error wraps as LLMError and rethrows', async () => {
    (callTutorLLM as jest.Mock).mockRejectedValueOnce(new Error('network'))

    await expect(
      runTutorOrchestrator({
        studentId: 's2',
        state: { sessionId: 'sess2', stage: 'HOOK', hintsRemaining: 3, lastTurnNumber: 2 },
        studentMessage: 'hello',
        subjectId: 'subj1',
        conceptId: 'c1',
      }),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })

    expect(prismaMock.aITutorTurnLog.create).toHaveBeenCalled()
  })
})
