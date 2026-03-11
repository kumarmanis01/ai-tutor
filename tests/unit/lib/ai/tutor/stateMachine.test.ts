import { applyTagTransition, type TutorSessionState, type TutorStage, type TutorTag } from '@/lib/ai/tutor/stateMachine'

function freeze<T extends object>(obj: T): T {
  return Object.freeze(obj)
}

function baseState(overrides?: Partial<TutorSessionState>): TutorSessionState {
  return {
    stage: 'HOOK',
    stageAttemptCount: 0,
    hintsUsed: 0,
    prereqRemediationActive: false,
    prereqReturnStage: null,
    consecutiveWrongAnswers: 0,
    ...overrides,
  }
}

const STAGES: TutorStage[] = [
  'HOOK',
  'PREREQ_BRIDGE',
  'CORE_EXPLANATION',
  'WORKED_EXAMPLE',
  'GUIDED_PRACTICE',
  'INDEPENDENT_PRACTICE',
  'CONSOLIDATION',
]

describe('applyTagTransition', () => {
  test('is pure: does not mutate input object', () => {
    const s = freeze(baseState({ stage: 'CORE_EXPLANATION', stageAttemptCount: 2, hintsUsed: 1 }))
    const next = applyTagTransition(s, 'QUESTION')
    expect(next).not.toBe(s)
    expect(s).toEqual({
      stage: 'CORE_EXPLANATION',
      stageAttemptCount: 2,
      hintsUsed: 1,
      prereqRemediationActive: false,
      prereqReturnStage: null,
      consecutiveWrongAnswers: 0,
    })
  })

  test('QUESTION: no-op', () => {
    const s = baseState({ stage: 'WORKED_EXAMPLE', stageAttemptCount: 1, hintsUsed: 2, consecutiveWrongAnswers: 1 })
    expect(applyTagTransition(s, 'QUESTION')).toEqual(s)
  })

  test('VALIDATE increments stageAttemptCount', () => {
    const s = baseState({ stage: 'WORKED_EXAMPLE', stageAttemptCount: 0 })
    expect(applyTagTransition(s, 'VALIDATE').stageAttemptCount).toBe(1)
  })

  test('VALIDATE preserves stage', () => {
    const s = baseState({ stage: 'GUIDED_PRACTICE', stageAttemptCount: 3 })
    expect(applyTagTransition(s, 'VALIDATE').stage).toBe('GUIDED_PRACTICE')
  })

  test('HINT_OFFER increments hintsUsed up to 3', () => {
    const s = baseState({ hintsUsed: 2 })
    expect(applyTagTransition(s, 'HINT_OFFER').hintsUsed).toBe(3)
    expect(applyTagTransition(baseState({ hintsUsed: 3 }), 'HINT_OFFER').hintsUsed).toBe(3)
  })

  test('STRUGGLE_DETECTED at attempt 1: consecutiveWrongAnswers++, stage unchanged', () => {
    const s = baseState({ stage: 'GUIDED_PRACTICE', stageAttemptCount: 1, consecutiveWrongAnswers: 0 })
    const next = applyTagTransition(s, 'STRUGGLE_DETECTED')
    expect(next.stage).toBe('GUIDED_PRACTICE')
    expect(next.consecutiveWrongAnswers).toBe(1)
  })

  test('STRUGGLE_DETECTED increments consecutiveWrongAnswers repeatedly', () => {
    const s = baseState({ stage: 'GUIDED_PRACTICE', stageAttemptCount: 2, consecutiveWrongAnswers: 2 })
    expect(applyTagTransition(s, 'STRUGGLE_DETECTED').consecutiveWrongAnswers).toBe(3)
  })

  test('STAGE_ADVANCE at CONSOLIDATION: no-op (already terminal)', () => {
    const s = baseState({ stage: 'CONSOLIDATION', stageAttemptCount: 4, hintsUsed: 2 })
    expect(applyTagTransition(s, 'STAGE_ADVANCE')).toEqual(s)
  })

  test('STAGE_ADVANCE when stageAttemptCount = 0 advances only if hintsUsed < 3', () => {
    const s1 = baseState({ stage: 'CORE_EXPLANATION', stageAttemptCount: 0, hintsUsed: 2 })
    expect(applyTagTransition(s1, 'STAGE_ADVANCE').stage).toBe('WORKED_EXAMPLE')

    const s2 = baseState({ stage: 'CORE_EXPLANATION', stageAttemptCount: 0, hintsUsed: 3 })
    expect(applyTagTransition(s2, 'STAGE_ADVANCE')).toEqual(s2)
  })

  test('STAGE_ADVANCE resets per-stage counters on advance', () => {
    const s = baseState({
      stage: 'CORE_EXPLANATION',
      stageAttemptCount: 3,
      hintsUsed: 2,
      consecutiveWrongAnswers: 2,
      prereqRemediationActive: true,
      prereqReturnStage: 'HOOK',
    })
    const next = applyTagTransition(s, 'STAGE_ADVANCE')
    expect(next.stage).toBe('WORKED_EXAMPLE')
    expect(next.stageAttemptCount).toBe(0)
    expect(next.hintsUsed).toBe(0)
    expect(next.consecutiveWrongAnswers).toBe(0)
    expect(next.prereqRemediationActive).toBe(false)
    expect(next.prereqReturnStage).toBeNull()
  })

  test('PREREQ_FAIL enters remediation: sets prereqRemediationActive and prereqReturnStage', () => {
    const s = baseState({ stage: 'WORKED_EXAMPLE', prereqRemediationActive: false, prereqReturnStage: null })
    const next = applyTagTransition(s, 'PREREQ_FAIL')
    expect(next.prereqRemediationActive).toBe(true)
    expect(next.prereqReturnStage).toBe('WORKED_EXAMPLE')
    expect(next.stage).toBe('PREREQ_BRIDGE')
  })

  test('PREREQ_FAIL -> PREREQ_FAIL again: stays in remediation, does not re-enter', () => {
    const s = baseState({ stage: 'PREREQ_BRIDGE', prereqRemediationActive: true, prereqReturnStage: 'WORKED_EXAMPLE' })
    expect(applyTagTransition(s, 'PREREQ_FAIL')).toEqual(s)
  })

  test('MASTERY_CONFIRMED during remediation returns to prereqReturnStage', () => {
    const s = baseState({
      stage: 'PREREQ_BRIDGE',
      prereqRemediationActive: true,
      prereqReturnStage: 'WORKED_EXAMPLE',
      stageAttemptCount: 2,
    })
    const next = applyTagTransition(s, 'MASTERY_CONFIRMED')
    expect(next.stage).toBe('WORKED_EXAMPLE')
    expect(next.prereqRemediationActive).toBe(false)
    expect(next.prereqReturnStage).toBeNull()
    expect(next.stageAttemptCount).toBe(0)
  })

  test('MASTERY_CONFIRMED outside remediation: invalid for current state -> unchanged, no throw', () => {
    const s = baseState({ stage: 'GUIDED_PRACTICE', prereqRemediationActive: false, prereqReturnStage: null })
    expect(() => applyTagTransition(s, 'MASTERY_CONFIRMED')).not.toThrow()
    expect(applyTagTransition(s, 'MASTERY_CONFIRMED')).toEqual(s)
  })

  test('Invalid tag for current stage: state unchanged, no throw (MASTERY_CONFIRMED on HOOK)', () => {
    const s = baseState({ stage: 'HOOK' })
    expect(() => applyTagTransition(s, 'MASTERY_CONFIRMED')).not.toThrow()
    expect(applyTagTransition(s, 'MASTERY_CONFIRMED')).toEqual(s)
  })

  test('PREREQ_FAIL resets counters when entering remediation', () => {
    const s = baseState({
      stage: 'INDEPENDENT_PRACTICE',
      stageAttemptCount: 4,
      hintsUsed: 3,
      consecutiveWrongAnswers: 2,
    })
    const next = applyTagTransition(s, 'PREREQ_FAIL')
    expect(next.stage).toBe('PREREQ_BRIDGE')
    expect(next.stageAttemptCount).toBe(0)
    expect(next.hintsUsed).toBe(0)
    expect(next.consecutiveWrongAnswers).toBe(0)
  })

  test('STAGE_ADVANCE in remediation can still advance within prereq stage', () => {
    const s = baseState({
      stage: 'PREREQ_BRIDGE',
      prereqRemediationActive: true,
      prereqReturnStage: 'GUIDED_PRACTICE',
      stageAttemptCount: 1,
      hintsUsed: 0,
    })
    const next = applyTagTransition(s, 'STAGE_ADVANCE')
    expect(next.stage).toBe('CORE_EXPLANATION')
    expect(next.prereqRemediationActive).toBe(false)
    expect(next.prereqReturnStage).toBeNull()
  })

  test('STAGE_ADVANCE progression order is correct for all non-terminal stages', () => {
    for (let i = 0; i < STAGES.length - 1; i++) {
      const stage = STAGES[i]
      const expected = STAGES[i + 1]
      const s = baseState({ stage, stageAttemptCount: 1, hintsUsed: 0 })
      expect(applyTagTransition(s, 'STAGE_ADVANCE').stage).toBe(expected)
    }
  })

  test('STAGE_ADVANCE does not advance when hintsUsed=3 and stageAttemptCount=0 for every stage', () => {
    for (const stage of STAGES) {
      if (stage === 'CONSOLIDATION') continue
      const s = baseState({ stage, stageAttemptCount: 0, hintsUsed: 3 })
      expect(applyTagTransition(s, 'STAGE_ADVANCE')).toEqual(s)
    }
  })

  test('STAGE_ADVANCE advances even with hintsUsed=3 if stageAttemptCount>0', () => {
    const s = baseState({ stage: 'WORKED_EXAMPLE', stageAttemptCount: 1, hintsUsed: 3 })
    expect(applyTagTransition(s, 'STAGE_ADVANCE').stage).toBe('GUIDED_PRACTICE')
  })

  test('VALIDATE does not change hintsUsed', () => {
    const s = baseState({ hintsUsed: 2 })
    expect(applyTagTransition(s, 'VALIDATE').hintsUsed).toBe(2)
  })

  test('STRUGGLE_DETECTED does not change stageAttemptCount', () => {
    const s = baseState({ stageAttemptCount: 2 })
    expect(applyTagTransition(s, 'STRUGGLE_DETECTED').stageAttemptCount).toBe(2)
  })

  test('PREREQ_FAIL does not overwrite prereqReturnStage when already in remediation', () => {
    const s = baseState({ stage: 'PREREQ_BRIDGE', prereqRemediationActive: true, prereqReturnStage: 'CORE_EXPLANATION' })
    expect(applyTagTransition(s, 'PREREQ_FAIL').prereqReturnStage).toBe('CORE_EXPLANATION')
  })

  test('MASTERY_CONFIRMED during remediation with missing prereqReturnStage: unchanged', () => {
    const s = baseState({ stage: 'PREREQ_BRIDGE', prereqRemediationActive: true, prereqReturnStage: null })
    expect(applyTagTransition(s, 'MASTERY_CONFIRMED')).toEqual(s)
  })

  test('STAGE_ADVANCE does not change student remediation return stage after remediation resolved', () => {
    const s = baseState({ stage: 'PREREQ_BRIDGE', prereqRemediationActive: true, prereqReturnStage: 'INDEPENDENT_PRACTICE', stageAttemptCount: 1, hintsUsed: 0 })
    const next = applyTagTransition(s, 'STAGE_ADVANCE')
    expect(next.prereqRemediationActive).toBe(false)
    expect(next.prereqReturnStage).toBeNull()
  })

  test('Repeated HINT_OFFER never exceeds 3', () => {
    let s = baseState({ hintsUsed: 0 })
    s = applyTagTransition(s, 'HINT_OFFER')
    s = applyTagTransition(s, 'HINT_OFFER')
    s = applyTagTransition(s, 'HINT_OFFER')
    s = applyTagTransition(s, 'HINT_OFFER')
    expect(s.hintsUsed).toBe(3)
  })

  test('PREREQ_FAIL keeps stage at PREREQ_BRIDGE even if already there but not in remediation (enters remediation)', () => {
    const s = baseState({ stage: 'PREREQ_BRIDGE', prereqRemediationActive: false, prereqReturnStage: null })
    const next = applyTagTransition(s, 'PREREQ_FAIL')
    expect(next.prereqRemediationActive).toBe(true)
    expect(next.prereqReturnStage).toBe('PREREQ_BRIDGE')
    expect(next.stage).toBe('PREREQ_BRIDGE')
  })

  test('STAGE_ADVANCE from PREREQ_BRIDGE in non-remediation advances normally', () => {
    const s = baseState({ stage: 'PREREQ_BRIDGE', prereqRemediationActive: false, prereqReturnStage: null, stageAttemptCount: 1 })
    expect(applyTagTransition(s, 'STAGE_ADVANCE').stage).toBe('CORE_EXPLANATION')
  })

  test('QUESTION does not clear remediation flags', () => {
    const s = baseState({ prereqRemediationActive: true, prereqReturnStage: 'WORKED_EXAMPLE', stage: 'PREREQ_BRIDGE' })
    expect(applyTagTransition(s, 'QUESTION')).toEqual(s)
  })

  test('VALIDATE during remediation increments stageAttemptCount', () => {
    const s = baseState({ prereqRemediationActive: true, prereqReturnStage: 'WORKED_EXAMPLE', stage: 'PREREQ_BRIDGE', stageAttemptCount: 0 })
    expect(applyTagTransition(s, 'VALIDATE').stageAttemptCount).toBe(1)
  })

  test('STAGE_ADVANCE does not advance if stage not recognized (defensive)', () => {
    const s = baseState({ stage: 'HOOK' as TutorStage })
    expect(() => applyTagTransition({ ...s, stage: 'UNKNOWN' as any }, 'STAGE_ADVANCE')).not.toThrow()
    expect(applyTagTransition({ ...s, stage: 'UNKNOWN' as any }, 'STAGE_ADVANCE')).toEqual({ ...s, stage: 'UNKNOWN' as any })
  })

  test('PREREQ_FAIL with unknown stage still enters remediation but coerces stage to PREREQ_BRIDGE', () => {
    const s = baseState({ stage: 'UNKNOWN' as any })
    const next = applyTagTransition(s as any, 'PREREQ_FAIL')
    expect(next.stage).toBe('PREREQ_BRIDGE')
    expect(next.prereqRemediationActive).toBe(true)
    expect(next.prereqReturnStage).toBe('UNKNOWN' as any)
  })

  test('STAGE_ADVANCE keeps prereqReturnStage null when not in remediation', () => {
    const s = baseState({ prereqRemediationActive: false, prereqReturnStage: null, stage: 'HOOK', stageAttemptCount: 1 })
    expect(applyTagTransition(s, 'STAGE_ADVANCE').prereqReturnStage).toBeNull()
  })

  test('STAGE_ADVANCE clears prereqReturnStage even if inconsistent flags set', () => {
    const s = baseState({ prereqRemediationActive: false, prereqReturnStage: 'HOOK', stage: 'WORKED_EXAMPLE', stageAttemptCount: 1 })
    const next = applyTagTransition(s, 'STAGE_ADVANCE')
    expect(next.prereqReturnStage).toBeNull()
  })

  test('VALIDATE returns new object (not same reference)', () => {
    const s = baseState({ stageAttemptCount: 0 })
    expect(applyTagTransition(s, 'VALIDATE')).not.toBe(s)
  })

  test('HINT_OFFER returns new object (not same reference)', () => {
    const s = baseState({ hintsUsed: 0 })
    expect(applyTagTransition(s, 'HINT_OFFER')).not.toBe(s)
  })

  test('PREREQ_FAIL returns new object (not same reference)', () => {
    const s = baseState({ stage: 'CORE_EXPLANATION' })
    expect(applyTagTransition(s, 'PREREQ_FAIL')).not.toBe(s)
  })

  test('MASTERY_CONFIRMED during remediation returns new object', () => {
    const s = baseState({ prereqRemediationActive: true, prereqReturnStage: 'CORE_EXPLANATION', stage: 'PREREQ_BRIDGE' })
    expect(applyTagTransition(s, 'MASTERY_CONFIRMED')).not.toBe(s)
  })
})

