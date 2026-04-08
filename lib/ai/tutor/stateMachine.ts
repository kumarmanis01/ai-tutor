// Pure, portable AI tutor state machine reducer.
// ZERO imports from app layer. No I/O. No side effects.

export type TutorStage =
  | 'HOOK'
  | 'PREREQ_BRIDGE'
  | 'CORE_EXPLANATION'
  | 'WORKED_EXAMPLE'
  | 'GUIDED_PRACTICE'
  | 'INDEPENDENT_PRACTICE'
  | 'CONSOLIDATION'

export type TutorTag =
  | 'QUESTION'
  | 'VALIDATE'
  | 'HINT_OFFER'
  | 'STAGE_ADVANCE'
  | 'PREREQ_FAIL'
  | 'STRUGGLE_DETECTED'
  | 'MASTERY_CONFIRMED'

export interface TutorSessionState {
  stage: TutorStage
  stageAttemptCount: number
  hintsUsed: number // 0-3
  prereqRemediationActive: boolean
  prereqReturnStage: TutorStage | null
  consecutiveWrongAnswers: number
}

const STAGE_ORDER: TutorStage[] = [
  'HOOK',
  'PREREQ_BRIDGE',
  'CORE_EXPLANATION',
  'WORKED_EXAMPLE',
  'GUIDED_PRACTICE',
  'INDEPENDENT_PRACTICE',
  'CONSOLIDATION',
]

function isKnownStage(stage: any): stage is TutorStage {
  return typeof stage === 'string' && (STAGE_ORDER as string[]).includes(stage)
}

function nextStage(stage: TutorStage): TutorStage | null {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx < 0) return null
  if (idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function clampInt(n: number, min: number, max: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min
  return Math.max(min, Math.min(max, x))
}

function resetPerStageCounters(s: TutorSessionState): TutorSessionState {
  return {
    ...s,
    stageAttemptCount: 0,
    hintsUsed: 0,
    consecutiveWrongAnswers: 0,
    prereqRemediationActive: false,
    prereqReturnStage: null,
  }
}

export function applyTagTransition(state: TutorSessionState, tag: TutorTag): TutorSessionState {
  // Defensive copy (pure function guarantee)
  let s: TutorSessionState = {
    stage: state.stage,
    stageAttemptCount: clampInt(state.stageAttemptCount, 0, 10_000),
    hintsUsed: clampInt(state.hintsUsed, 0, 3),
    prereqRemediationActive: !!state.prereqRemediationActive,
    prereqReturnStage: state.prereqReturnStage ?? null,
    consecutiveWrongAnswers: clampInt(state.consecutiveWrongAnswers, 0, 10_000),
  }

  // If stage is unknown, only PREREQ_FAIL has a defined safe behaviour in tests.
  if (!isKnownStage(s.stage)) {
    if (tag === 'PREREQ_FAIL') {
      return {
        ...s,
        prereqRemediationActive: true,
        prereqReturnStage: (s.stage as any) ?? null,
        stage: 'PREREQ_BRIDGE',
        stageAttemptCount: 0,
        hintsUsed: 0,
        consecutiveWrongAnswers: 0,
      }
    }
    return s
  }

  // AC-08 (F-STU-011 MUST): reset consecutive wrong counter on any correct signal
  if (tag === 'STAGE_ADVANCE' || tag === 'MASTERY_CONFIRMED' || tag === 'VALIDATE') {
    s = { ...s, consecutiveWrongAnswers: 0 }
  }

  switch (tag) {
    case 'QUESTION':
      return s

    case 'VALIDATE':
      return { ...s, stageAttemptCount: s.stageAttemptCount + 1, consecutiveWrongAnswers: 0 }

    case 'HINT_OFFER':
      return { ...s, hintsUsed: clampInt(s.hintsUsed + 1, 0, 3) }

    case 'STRUGGLE_DETECTED':
      return { ...s, consecutiveWrongAnswers: s.consecutiveWrongAnswers + 1, stageAttemptCount: s.stageAttemptCount + 1 }

    case 'PREREQ_FAIL': {
      // Already in remediation: no-op (do not re-enter)
      if (s.prereqRemediationActive) return s
      return {
        ...s,
        prereqRemediationActive: true,
        prereqReturnStage: s.stage,
        stage: 'PREREQ_BRIDGE',
        stageAttemptCount: 0,
        hintsUsed: 0,
        consecutiveWrongAnswers: 0,
      }
    }

    case 'MASTERY_CONFIRMED': {
      // Valid only during remediation with a return stage
      if (!s.prereqRemediationActive) return s
      if (!s.prereqReturnStage) return s
      return {
        ...s,
        stage: s.prereqReturnStage,
        prereqRemediationActive: false,
        prereqReturnStage: null,
        stageAttemptCount: 0,
      }
    }

    case 'STAGE_ADVANCE': {
      // Terminal stage: no-op
      if (s.stage === 'CONSOLIDATION') return s

      // Guard: if they've never attempted the stage AND burned all hints, don't advance.
      if (s.stageAttemptCount === 0 && s.hintsUsed >= 3) return s

      const n = nextStage(s.stage)
      if (!n) return s

      // If we were in remediation, exiting remediation on any successful advance.
      const cleared = resetPerStageCounters(s)
      return { ...cleared, stage: n }
    }
  }
}

/**
 * Apply a tag transition and auto-upgrade STRUGGLE_DETECTED to PREREQ_FAIL
 * when the student reaches 3 consecutive wrong answers (AC-08, F-STU-011 MUST).
 *
 * This is the function used by the orchestrator -- prefer it over applyTagTransition.
 */
export function applyTagTransitionWithRemediation(
  state: TutorSessionState,
  tag: TutorTag,
): { next: TutorSessionState; effectiveTag: TutorTag } {
  const next = applyTagTransition(state, tag)

  if (
    tag === 'STRUGGLE_DETECTED' &&
    next.consecutiveWrongAnswers >= 3 &&
    !next.prereqRemediationActive
  ) {
    // AC-08: auto-upgrade -- student has given 3 consecutive wrong answers
    return { next: applyTagTransition(next, 'PREREQ_FAIL'), effectiveTag: 'PREREQ_FAIL' }
  }

  return { next, effectiveTag: tag }
}

